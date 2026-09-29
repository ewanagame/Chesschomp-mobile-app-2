import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  estimateReviewDurationSeconds,
  formatReviewDurationEstimate,
  isReusableCachedReview,
  REVIEW_ANALYSIS_VERSION,
  reviewMovetimeMsForDepth,
  reviewSearchForDepth,
} from './reviewSettings';

describe('review search timing', () => {
  it('caps recommended depth 18 around 300ms per search', () => {
    assert.equal(reviewMovetimeMsForDepth(18), 288);
    assert.deepEqual(reviewSearchForDepth(18), {
      kind: 'depthMovetime',
      depth: 18,
      movetimeMs: 288,
    });
  });

  it('estimates a 50-move game at depth 18 within about a minute', () => {
    const fiftyPlies = estimateReviewDurationSeconds(18, 50);
    const hundredPlies = estimateReviewDurationSeconds(18, 100);
    assert.ok(fiftyPlies >= 20 && fiftyPlies <= 60, `50 plies: ${fiftyPlies}s`);
    assert.ok(hundredPlies <= 90, `100 plies: ${hundredPlies}s`);
    assert.equal(formatReviewDurationEstimate(fiftyPlies), `~${fiftyPlies}s`);
    assert.equal(formatReviewDurationEstimate(70), '~1 min');
  });

  it('ignores cached reviews from older analysis versions', () => {
    const moves = [{}, {}];
    assert.equal(isReusableCachedReview({ classifiedMoves: moves }, 2), false);
    assert.equal(
      isReusableCachedReview({ analysisVersion: 1, classifiedMoves: moves }, 2),
      false,
    );
    assert.equal(
      isReusableCachedReview(
        { analysisVersion: REVIEW_ANALYSIS_VERSION, classifiedMoves: moves },
        2,
      ),
      true,
    );
  });
});
