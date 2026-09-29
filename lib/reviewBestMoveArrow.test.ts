import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { bestMoveArrowForReviewRecord } from './reviewBestMoveArrow';

function baseRecord(overrides: Partial<ClassifiedMoveRecord> = {}): ClassifiedMoveRecord {
  return {
    move: 'e2e4',
    san: 'e4',
    color: 'w',
    classification: 'Inaccuracy',
    evalBefore: 20,
    evalAfter: 10,
    wasBestMove: false,
    bestMoveUci: 'd2d4',
    fenBefore: 'start',
    fenAfter: 'after',
    ...overrides,
  };
}

describe('bestMoveArrowForReviewRecord', () => {
  it('returns the parsed best move arrow when the played move was not best', () => {
    assert.deepEqual(bestMoveArrowForReviewRecord(baseRecord()), {
      from: 'd2',
      to: 'd4',
    });
  });

  it('returns null when the played move was best', () => {
    assert.equal(
      bestMoveArrowForReviewRecord(
        baseRecord({
          move: 'd2d4',
          wasBestMove: true,
          classification: 'Best',
        }),
      ),
      null,
    );
  });

  it('returns null for forced moves', () => {
    assert.equal(
      bestMoveArrowForReviewRecord(baseRecord({ forced: true })),
      null,
    );
  });

  it('returns null when best move uci is missing', () => {
    assert.equal(
      bestMoveArrowForReviewRecord(baseRecord({ bestMoveUci: undefined })),
      null,
    );
  });

  it('returns null when the best-move piece is not on the from square in the display fen', () => {
    assert.equal(
      bestMoveArrowForReviewRecord(
        baseRecord({
          move: 'g1h3',
          bestMoveUci: 'g1f3',
          fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        }),
        'rnbqkbnr/pppppppp/8/7N/8/8/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      ),
      null,
    );
  });

  it('returns the arrow when validating against fenBefore', () => {
    assert.deepEqual(
      bestMoveArrowForReviewRecord(
        baseRecord({
          move: 'g1h3',
          bestMoveUci: 'g1f3',
          fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        }),
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      ),
      { from: 'g1', to: 'f3' },
    );
  });
});
