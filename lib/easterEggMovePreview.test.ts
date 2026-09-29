import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';

import { findEasterEggCandidateSync } from './easterEggMovePreview';
import type { PositionAnalysis } from './stockfishAnalysis';

function analysis(fen: string, bestMoveUci: string): PositionAnalysis {
  const sideToMove = fen.split(/\s+/)[1] === 'b' ? 'b' : 'w';
  return {
    fen,
    sideToMove,
    evalCentipawns: 0,
    bestMoveUci,
    scoreCp: 0,
    scoreMate: null,
  };
}

describe('findEasterEggCandidateSync', () => {
  it('returns null when cache is missing', () => {
    const game = new Chess();
    assert.equal(findEasterEggCandidateSync(game.fen(), 'e2', null, game), null);
  });

  it('returns null when best move is not from the picked piece', () => {
    const game = new Chess();
    const fen = game.fen();
    const cached = analysis(fen, 'd2d4');
    assert.equal(findEasterEggCandidateSync(fen, 'e2', cached, game), null);
  });

  it('returns null for promotion best moves', () => {
    const game = new Chess('8/P7/8/8/8/8/8/4K2k w - - 0 1');
    const fen = game.fen();
    const cached = analysis(fen, 'a7a8q');
    assert.equal(findEasterEggCandidateSync(fen, 'a7', cached, game), null);
  });

  it('returns candidate when picked piece matches engine best move', () => {
    const game = new Chess();
    const fen = game.fen();
    const cached = analysis(fen, 'e2e4');
    const candidate = findEasterEggCandidateSync(fen, 'e2', cached, game);
    assert.ok(candidate);
    assert.equal(candidate.from, 'e2');
    assert.equal(candidate.to, 'e4');
    assert.equal(candidate.isMaterialSacrifice, false);
  });

  it('returns null on forced single-move positions', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
    const fen = game.fen();
    const cached = analysis(fen, 'f7f8q');
    assert.equal(findEasterEggCandidateSync(fen, 'f7', cached, game), null);
  });
});
