import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';

import {
  countCurrentPositionOccurrences,
  shouldShowRepetitionDrawWarning,
} from './repetitionDrawWarning';

describe('countCurrentPositionOccurrences', () => {
  it('returns 1 for the starting position before any move', () => {
    const chess = new Chess();
    assert.equal(countCurrentPositionOccurrences(chess), 1);
  });

  it('returns 1 for a unique position in the game', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    assert.equal(countCurrentPositionOccurrences(chess), 1);
  });

  it('returns 2 when the current position has appeared once before', () => {
    const chess = new Chess();
    for (const san of ['Nf3', 'Nc6', 'Ng1', 'Nb8']) {
      chess.move(san);
    }
    assert.equal(countCurrentPositionOccurrences(chess), 2);
  });

  it('returns 3 after threefold repetition is reached', () => {
    const chess = new Chess();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (const san of ['Nf3', 'Nc6', 'Ng1', 'Nb8']) {
        chess.move(san);
      }
    }
    assert.equal(countCurrentPositionOccurrences(chess), 4);
    assert.equal(chess.isThreefoldRepetition(), true);
  });
});

describe('shouldShowRepetitionDrawWarning', () => {
  it('is false at the start of the game', () => {
    const chess = new Chess();
    assert.equal(shouldShowRepetitionDrawWarning(chess), false);
  });

  it('is false for a unique position', () => {
    const chess = new Chess();
    chess.move('d4');
    chess.move('d5');
    assert.equal(shouldShowRepetitionDrawWarning(chess), false);
  });

  it('is true when the current position has occurred twice', () => {
    const chess = new Chess();
    for (const san of ['Nf3', 'Nc6', 'Ng1', 'Nb8']) {
      chess.move(san);
    }
    assert.equal(shouldShowRepetitionDrawWarning(chess), true);
    assert.equal(chess.isGameOver(), false);
  });

  it('is false once threefold repetition has ended the game', () => {
    const chess = new Chess();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      for (const san of ['Nf3', 'Nc6', 'Ng1', 'Nb8']) {
        chess.move(san);
      }
    }
    assert.equal(chess.isGameOver(), true);
    assert.equal(shouldShowRepetitionDrawWarning(chess), false);
  });
});
