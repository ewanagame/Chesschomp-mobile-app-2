import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reviewDisplayFenForPly } from './reviewBoardPosition';

describe('reviewDisplayFenForPly', () => {
  it('returns the starting position before any move is selected', () => {
    assert.equal(
      reviewDisplayFenForPly(-1, ['fen-after-0']),
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });

  it('prefers the classified record fenAfter for a ply', () => {
    assert.equal(
      reviewDisplayFenForPly(
        1,
        ['fen-after-0', 'fen-after-1'],
        {
          move: 'e7e5',
          san: 'e5',
          color: 'b',
          classification: 'Best',
          evalBefore: 0,
          evalAfter: 0,
          wasBestMove: true,
          fenBefore: 'fen-before-1',
          fenAfter: 'record-fen-after-1',
        },
      ),
      'record-fen-after-1',
    );
  });

  it('falls back to stored review fens', () => {
    assert.equal(reviewDisplayFenForPly(0, ['fen-after-0']), 'fen-after-0');
  });
});
