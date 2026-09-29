import { Chess } from 'chess.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  moveSoundYieldsToBrilliant,
  replayMoveFromRecord,
  resolveMoveSoundEvent,
  shouldUseChompCaptureSound,
} from './chessMoveSound';

describe('shouldUseChompCaptureSound', () => {
  it('uses chomp when enabled and move captures', () => {
    const game = new Chess();
    const move = game.move('e4')!;
    game.move('d5');
    const capture = game.move('exd5')!;

    assert.equal(shouldUseChompCaptureSound(capture, game, true), true);
  });

  it('skips chomp when toggle is off', () => {
    const game = new Chess();
    game.move('e4');
    game.move('d5');
    const capture = game.move('exd5')!;

    assert.equal(shouldUseChompCaptureSound(capture, game, false), false);
  });

  it('skips chomp on checkmate even when enabled', () => {
    const game = new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    const capture = game.move('Qxf7')!;

    assert.ok(game.isCheckmate());
    assert.equal(shouldUseChompCaptureSound(capture, game, true), false);
  });
});

describe('moveSoundYieldsToBrilliant', () => {
  it('yields on check and capture, not on a quiet move', () => {
    const quiet = new Chess();
    const quietMove = quiet.move('e4')!;
    assert.equal(moveSoundYieldsToBrilliant(quietMove, quiet), false);

    quiet.move('f6');
    const check = quiet.move('Qh5')!;
    assert.equal(check.san, 'Qh5+');
    assert.equal(moveSoundYieldsToBrilliant(check, quiet), true);

    const captureGame = new Chess();
    captureGame.move('e4');
    captureGame.move('d5');
    const capture = captureGame.move('exd5')!;
    assert.equal(moveSoundYieldsToBrilliant(capture, captureGame), true);
  });
});

describe('replayMoveFromRecord', () => {
  it('replays a classified move from fenBefore', () => {
    const fenBefore = new Chess().fen();
    const game = new Chess();
    const move = game.move('e4')!;

    const replayed = replayMoveFromRecord({
      move: 'e2e4',
      san: 'e4',
      color: 'w',
      classification: 'Best',
      evalBefore: 20,
      evalAfter: 25,
      wasBestMove: true,
      fenBefore,
      fenAfter: move.after,
    });

    assert.ok(replayed);
    assert.equal(replayed.move.san, 'e4');
    assert.equal(replayed.gameAfterMove.fen(), move.after);
  });
});

describe('resolveMoveSoundEvent capture priority', () => {
  it('returns capture for plain captures when chomp is handled separately', () => {
    const game = new Chess();
    game.move('e4');
    game.move('d5');
    const capture = game.move('exd5')!;

    assert.equal(resolveMoveSoundEvent(capture, game, 'w'), 'capture');
  });
});
