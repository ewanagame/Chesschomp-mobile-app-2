import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatReviewAnalysisError } from './reviewAnalysisError';

describe('formatReviewAnalysisError', () => {
  it('hides raw fen strings for timeout errors', () => {
    assert.equal(
      formatReviewAnalysisError(
        new Error('Stockfish analysis timed out for fen: abc123'),
        17,
        44,
      ),
      'Analysis stopped at move 17 of 44. Tap Retry to continue.',
    );
  });

  it('passes through non-timeout errors unchanged', () => {
    assert.equal(
      formatReviewAnalysisError(new Error('Unable to replay move: QxQ'), 3, 10),
      'Unable to replay move: QxQ',
    );
  });
});
