import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMoveHistoryRows, pieceTypeFromSan } from './moveHistory';

describe('buildMoveHistoryRows', () => {
  it('groups SAN moves into numbered white/black rows', () => {
    assert.deepEqual(buildMoveHistoryRows(['e4', 'e5', 'Nf3']), [
      {
        moveNumber: 1,
        white: { plyIndex: 0, san: 'e4' },
        black: { plyIndex: 1, san: 'e5' },
      },
      {
        moveNumber: 2,
        white: { plyIndex: 2, san: 'Nf3' },
        black: undefined,
      },
    ]);
  });
});

describe('pieceTypeFromSan', () => {
  it('returns null for pawn moves', () => {
    assert.equal(pieceTypeFromSan('e4'), null);
    assert.equal(pieceTypeFromSan('exd5'), null);
    assert.equal(pieceTypeFromSan('e8=Q'), null);
  });

  it('maps piece prefixes and castling to piece types', () => {
    assert.equal(pieceTypeFromSan('Nf3'), 'n');
    assert.equal(pieceTypeFromSan('Bxc5'), 'b');
    assert.equal(pieceTypeFromSan('Rad1'), 'r');
    assert.equal(pieceTypeFromSan('Qh5'), 'q');
    assert.equal(pieceTypeFromSan('Kf1'), 'k');
    assert.equal(pieceTypeFromSan('O-O'), 'k');
    assert.equal(pieceTypeFromSan('O-O-O'), 'k');
  });
});
