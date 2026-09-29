import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';

import {
  CHESS_COM_EXPECTED_POINTS,
  centipawnsToWinPercent,
  classifyMove,
  expectedPointsLost,
  classifyMoveQuality,
  meetsBrilliantEvalThreshold,
  BRILLIANT_MIN_EVAL_CP,
} from './moveClassification';
import { isMaterialSacrifice } from '../lib/materialEval';
import { detectMissedWin } from '../lib/missedWin';
import type { PositionAnalysis } from '../lib/stockfishAnalysis';

function analysis(
  fen: string,
  evalCentipawns: number,
  bestMoveUci = '',
  scoreMate: number | null = null,
): PositionAnalysis {
  const sideToMove = fen.split(/\s+/)[1] === 'b' ? 'b' : 'w';
  return {
    fen,
    sideToMove,
    evalCentipawns,
    bestMoveUci,
    scoreCp: scoreMate == null ? evalCentipawns : null,
    scoreMate,
  };
}

describe('chess.com-style move quality (Step 2)', () => {
  it('uses documented expected-points thresholds', () => {
    assert.equal(CHESS_COM_EXPECTED_POINTS.excellent, 0.02);
    assert.equal(CHESS_COM_EXPECTED_POINTS.good, 0.05);
    assert.equal(CHESS_COM_EXPECTED_POINTS.inaccuracy, 0.1);
    assert.equal(CHESS_COM_EXPECTED_POINTS.mistake, 0.2);
  });

  it('classifies tiny loss as Excellent', () => {
    const loss = expectedPointsLost(100, 95);
    assert.ok(loss <= 0.02);
    assert.equal(classifyMoveQuality(loss), 'Excellent');
  });

  it('never labels non-best zero-loss moves as Best via quality tiers', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: -800,
        evalAfterMoveCentipawns: -800,
        wasBestMove: false,
        isBookMove: false,
      }),
      'Excellent',
    );
  });

  it('Best + missed win cannot coexist when wasBestMove is true', () => {
    const classification = classifyMove({
      evalBeforeMoveCentipawns: 100,
      evalAfterMoveCentipawns: 100,
      wasBestMove: true,
      isBookMove: false,
    });
    assert.equal(classification, 'Best');
    // Hook skips missed-win when wasBestMove; quality must not invent Best when wasBestMove false.
  });

  it('classifies large loss as Blunder', () => {
    const loss = expectedPointsLost(300, -400);
    assert.ok(loss > 0.2);
    assert.equal(classifyMoveQuality(loss), 'Blunder');
  });

  it('always Blunder when allowing opponent mate', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 400,
        evalAfterMoveCentipawns: -99_000,
        wasBestMove: false,
        isBookMove: false,
        allowsOpponentMate: true,
      }),
      'Blunder',
    );
  });

  it('does not label the engine best move as a Blunder even if after-eval is noisy', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 400,
        evalAfterMoveCentipawns: -99_000,
        wasBestMove: true,
        isBookMove: false,
        allowsOpponentMate: true,
      }),
      'Best',
    );
  });

  it('labels a winning underpromotion as Brilliant when it was the best move', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 99_000,
        evalAfterMoveCentipawns: 99_000,
        wasBestMove: true,
        isBookMove: false,
        isUnderpromotion: true,
      }),
      'Brilliant',
    );
  });

  it('classifies checkmate delivery as Best even when engine preferred another mate', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 99_000,
        evalAfterMoveCentipawns: 99_000,
        wasBestMove: false,
        isBookMove: false,
        missedForcedMate: true,
        deliveredCheckmate: true,
      }),
      'Best',
    );
  });

  it('labels opening theory as Book instead of Best when still in book', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 20,
        evalAfterMoveCentipawns: 20,
        wasBestMove: true,
        isBookMove: true,
      }),
      'Book',
    );
  });

  it('does not label a book best move as Great without a large win-probability gap', () => {
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 20,
        evalAfterMoveCentipawns: 20,
        wasBestMove: true,
        isBookMove: true,
        bestSecondWinPercentGap: 3,
      }),
      'Book',
    );
  });

  it('labels a best-move sacrifice as Brilliant when eval stays at least equal', () => {
    assert.equal(BRILLIANT_MIN_EVAL_CP, 0);
    assert.ok(meetsBrilliantEvalThreshold(0));
    assert.ok(meetsBrilliantEvalThreshold(15));
    assert.equal(
      classifyMove({
        evalBeforeMoveCentipawns: 120,
        evalAfterMoveCentipawns: 15,
        wasBestMove: true,
        isBookMove: false,
        isMaterialSacrifice: true,
      }),
      'Brilliant',
    );
  });

  it('does not label a sacrifice as Brilliant when eval falls below the buffer', () => {
    assert.ok(!meetsBrilliantEvalThreshold(-15));
    assert.ok(!meetsBrilliantEvalThreshold(-25));
    assert.notEqual(
      classifyMove({
        evalBeforeMoveCentipawns: 120,
        evalAfterMoveCentipawns: -25,
        wasBestMove: true,
        isBookMove: false,
        isMaterialSacrifice: true,
      }),
      'Brilliant',
    );
  });
});

describe('missed win vs quality (independent checks)', () => {
  it('Scenario A: Missed Win only — still winning, gave up best line', () => {
    const before = analysis('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 800, 'e7e5');
    // After best ...e5 — White to move, engine says Black is +900 up (cp from White POV = -900).
    const afterBest = analysis('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', -900);
    // After inferior ...Nc6 — White to move, Black still +350 up.
    const afterPlayed = analysis('rnbqkbnr/pppppppp/8/8/4P3/4N3/PPPP1PPP/RNBQKB1R w KQkq - 1 1', -350);

    const missed = detectMissedWin({
      beforeAnalysis: before,
      bestMoveAfterAnalysis: afterBest,
      afterAnalysis: afterPlayed,
      mover: 'b',
      wasBestMove: false,
      deliveredCheckmate: false,
    });

    const quality = classifyMove({
      evalBeforeMoveCentipawns: 800,
      evalAfterMoveCentipawns: 350,
      wasBestMove: false,
      isBookMove: false,
    });

    assert.equal(missed.missedWin, true);
    assert.notEqual(quality, 'Blunder');
    assert.ok(['Good', 'Inaccuracy', 'Mistake', 'Excellent'].includes(quality));
  });

  it('Scenario B: Blunder without missed win — equal to losing, no winning line', () => {
    const before = analysis('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP/RNBQKBNR w KQkq - 0 1', 50, 'e2e4');
    const afterBest = analysis('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 80);
    const afterPlayed = analysis('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP/RNBQKBNR w KQkq - 0 1', -400);

    const missed = detectMissedWin({
      beforeAnalysis: before,
      bestMoveAfterAnalysis: afterBest,
      afterAnalysis: afterPlayed,
      mover: 'w',
      wasBestMove: false,
      deliveredCheckmate: false,
    });

    const quality = classifyMove({
      evalBeforeMoveCentipawns: 50,
      evalAfterMoveCentipawns: -400,
      wasBestMove: false,
      isBookMove: false,
    });

    assert.equal(missed.missedWin, false);
    assert.equal(quality, 'Blunder');
  });

  it('Scenario C: Both — had mate in 1, allowed opponent mate', () => {
    const before = analysis('6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1', 99_000, 'f7g7', 1);
    const afterBest = analysis('6k1/5Q2/6K1/8/8/8/8/8 b - - 1 1', 99_000, '', -1);
    const afterPlayed = analysis('6k1/8/6K1/5Q2/8/8/8/8 b - - 0 1', -99_000, '', 1);

    const missed = detectMissedWin({
      beforeAnalysis: before,
      bestMoveAfterAnalysis: afterBest,
      afterAnalysis: afterPlayed,
      mover: 'w',
      wasBestMove: false,
      deliveredCheckmate: false,
    });

    const quality = classifyMove({
      evalBeforeMoveCentipawns: 900,
      evalAfterMoveCentipawns: -99_000,
      wasBestMove: false,
      isBookMove: false,
      allowsOpponentMate: true,
    });

    assert.equal(missed.missedWin, true);
    assert.equal(quality, 'Blunder');
  });
});

describe('before/after regression (old conflated logic)', () => {
  it('no longer returns MissedWin as primary classification', () => {
    const quality = classifyMove({
      evalBeforeMoveCentipawns: 800,
      evalAfterMoveCentipawns: 350,
      wasBestMove: false,
      isBookMove: false,
    });
    assert.notEqual(quality, 'MissedWin');
  });

  it('before/after: zero EP loss without wasBestMove is Excellent not Best', () => {
    const quality = classifyMove({
      evalBeforeMoveCentipawns: -800,
      evalAfterMoveCentipawns: -800,
      wasBestMove: false,
      isBookMove: false,
    });
    assert.notEqual(quality, 'Best');
    assert.equal(quality, 'Excellent');
  });

  it('no longer downgrades missed win + blunder to blunder-only via safeguard', () => {
    const missed = detectMissedWin({
      beforeAnalysis: analysis('6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1', 99_000, 'f7g7', 1),
      bestMoveAfterAnalysis: analysis('6k1/5Q2/6K1/8/8/8/8/8 b - - 1 1', 99_000, '', -1),
      afterAnalysis: analysis('6k1/8/6K1/5Q2/8/8/8/8 b - - 0 1', -99_000, '', 1),
      mover: 'w',
      wasBestMove: false,
      deliveredCheckmate: false,
    });
    assert.equal(missed.missedWin, true);
  });

  it('regression: suboptimal move with flat eval cannot be Best + missed win', () => {
    const before = analysis('8/8/8/8/8/8/5k2/8 b - - 0 1', -800, 'f2e2');
    const afterBest = analysis('8/8/8/8/8/8/4k3/8 w - - 1 1', -950);
    const afterPlayed = analysis('8/8/8/8/8/8/5k2/8 w - - 0 1', -800);

    const missed = detectMissedWin({
      beforeAnalysis: before,
      bestMoveAfterAnalysis: afterBest,
      afterAnalysis: afterPlayed,
      mover: 'b',
      wasBestMove: false,
      deliveredCheckmate: false,
    });

    const quality = classifyMove({
      evalBeforeMoveCentipawns: 800,
      evalAfterMoveCentipawns: 800,
      wasBestMove: false,
      isBookMove: false,
    });

    assert.equal(missed.missedWin, true);
    assert.notEqual(quality, 'Best');
    assert.equal(quality, 'Excellent');
  });
});

describe('isMaterialSacrifice', () => {
  function play(fen: string, san: string) {
    const chess = new Chess(fen);
    const move = chess.move(san);
    if (!move) {
      throw new Error(`illegal move ${san} from ${fen}`);
    }
    return { fenBefore: fen, fenAfter: chess.fen(), move };
  }

  it('does not flag a knight-for-pawn trade when the knight is recaptured and the defender takes back', () => {
    // Nf5xh6. A queen on a6 can also take the knight, which the old worst-case
    // recapture treated as a sacrifice. The rational reply is g7xh6, then g5xh6.
    const fen = '4k3/6p1/q6p/5NP1/8/8/P7/4K3 w - - 0 1';
    const played = play(fen, 'Nxh6');
    assert.equal(
      isMaterialSacrifice(played.fenBefore, played.fenAfter, played.move, 'w', 'g7h6'),
      false,
    );
  });

  it('flags a piece left en prise when nothing can recapture the taker', () => {
    const fen = '4k3/8/p7/8/B7/8/8/4K3 w - - 0 1';
    const played = play(fen, 'Bb5');
    assert.equal(
      isMaterialSacrifice(played.fenBefore, played.fenAfter, played.move, 'w', 'a6b5'),
      true,
    );
  });

  it('flags a different piece left hanging when the best reply captures it', () => {
    const fen = '4k3/8/1p6/N7/8/8/7P/4K3 w - - 0 1';
    const played = play(fen, 'h3');
    assert.equal(
      isMaterialSacrifice(played.fenBefore, played.fenAfter, played.move, 'w', 'b6a5'),
      true,
    );
  });
});
