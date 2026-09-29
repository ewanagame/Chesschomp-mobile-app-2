import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';

import { buildGameOutcome, getDrawExplanation } from './gameResult';

describe('getDrawExplanation', () => {
  it('explains stalemate when the side to move is not in check but has no moves', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    assert.equal(game.isStalemate(), true);

    const explanation = getDrawExplanation(game);
    assert.ok(explanation);
    assert.match(explanation, /stalemate/i);
    assert.match(explanation, /not a win/i);
  });

  it('returns null for checkmate', () => {
    const game = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    assert.equal(game.isCheckmate(), true);
    assert.equal(getDrawExplanation(game), null);
  });

  it('returns null when the game ended early', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    assert.equal(getDrawExplanation(game, true), null);
  });
});

describe('buildGameOutcome', () => {
  it('includes a draw explanation for stalemate', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    const outcome = buildGameOutcome(game);

    assert.equal(outcome.result, 'Draw by stalemate');
    assert.ok(outcome.explanation);
  });

  it('omits explanation for resignation', () => {
    const game = new Chess();
    const outcome = buildGameOutcome(game, { resignedColor: 'w' });

    assert.match(outcome.result, /resigned/i);
    assert.equal(outcome.explanation, null);
  });
});
