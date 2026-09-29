import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';

import { findKingSquare, winnerColorAfterCheckmate } from './kingSquare';

describe('kingSquare helpers', () => {
  it('finds white king on e1 from start position', () => {
    const chess = new Chess();
    assert.equal(findKingSquare(chess, 'w'), 'e1');
    assert.equal(findKingSquare(chess, 'b'), 'e8');
  });

  it('finds both kings in a checkmate position', () => {
    const chess = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    assert.ok(chess.isCheckmate());
    assert.equal(findKingSquare(chess, 'w'), 'e1');
    assert.equal(findKingSquare(chess, 'b'), 'e8');
  });

  it('identifies winner as opposite of side to move after checkmate', () => {
    const chess = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    assert.ok(chess.isCheckmate());
    assert.equal(chess.turn(), 'w');
    assert.equal(winnerColorAfterCheckmate(chess), 'b');
  });
});
