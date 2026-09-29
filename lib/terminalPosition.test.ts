import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { liveEvalFromAnalysis } from './stockfishAnalysis';
import { getTerminalPositionAnalysis } from './terminalPosition';

describe('terminal position analysis', () => {
  it('synthesizes checkmate eval for the mated side to move', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const analysis = getTerminalPositionAnalysis(fen);

    assert.ok(analysis);
    assert.equal(analysis.scoreMate, 0);
    assert.equal(analysis.evalCentipawns, -100_000);
    assert.equal(analysis.sideToMove, 'w');
  });

  it('synthesizes draw eval for stalemate', () => {
    const fen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    const analysis = getTerminalPositionAnalysis(fen);

    assert.ok(analysis);
    assert.equal(analysis.evalCentipawns, 0);
    assert.equal(analysis.scoreMate, null);
  });
});

describe('liveEvalFromAnalysis mate 0', () => {
  it('maps mate 0 with white to move to black winning (-M1)', () => {
    const live = liveEvalFromAnalysis({
      fen: '6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
      sideToMove: 'w',
      evalCentipawns: -100_000,
      bestMoveUci: '',
      scoreMate: 0,
    });

    assert.equal(live.mateInWhite, -1);
  });

  it('maps mate 0 with black to move to white winning (M1)', () => {
    const live = liveEvalFromAnalysis({
      fen: '6K1/5ppp/8/8/8/8/5PPP/6k1 b - - 0 1',
      sideToMove: 'b',
      evalCentipawns: -100_000,
      bestMoveUci: '',
      scoreMate: 0,
    });

    assert.equal(live.mateInWhite, 1);
  });
});
