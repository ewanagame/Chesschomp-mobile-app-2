import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PLAYER_PIECE_TYPE,
  isPlayerPieceType,
  normalizePlayerPieceType,
  PLAYER_PIECE_OPTIONS,
} from './playerPiece';

describe('normalizePlayerPieceType', () => {
  it('accepts every valid piece option', () => {
    for (const option of PLAYER_PIECE_OPTIONS) {
      assert.equal(normalizePlayerPieceType(option), option);
    }
  });

  it('falls back to the default pawn for invalid input', () => {
    assert.equal(normalizePlayerPieceType('x'), DEFAULT_PLAYER_PIECE_TYPE);
    assert.equal(normalizePlayerPieceType(undefined), DEFAULT_PLAYER_PIECE_TYPE);
    assert.equal(normalizePlayerPieceType(null), DEFAULT_PLAYER_PIECE_TYPE);
    assert.equal(normalizePlayerPieceType(42), DEFAULT_PLAYER_PIECE_TYPE);
  });
});

describe('isPlayerPieceType', () => {
  it('rejects unknown strings', () => {
    assert.equal(isPlayerPieceType('king'), false);
  });
});
