import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampReviewPlaybackSpeed,
  formatReviewPlaybackSpeedLabel,
  reviewAutoplayDelayMs,
  REVIEW_AUTOPLAY_MS,
} from './reviewSettings';

describe('review playback speed', () => {
  it('snaps to supported speed steps', () => {
    assert.equal(clampReviewPlaybackSpeed(0.25), 0.25);
    assert.equal(clampReviewPlaybackSpeed(0.4), 0.5);
    assert.equal(clampReviewPlaybackSpeed(2), 2);
    assert.equal(clampReviewPlaybackSpeed(99), 2);
  });

  it('formats speed labels', () => {
    assert.equal(formatReviewPlaybackSpeedLabel(1), '1×');
    assert.equal(formatReviewPlaybackSpeedLabel(1.25), '1.25×');
  });

  it('scales autoplay delay inversely with speed', () => {
    assert.equal(reviewAutoplayDelayMs(1), REVIEW_AUTOPLAY_MS);
    assert.equal(reviewAutoplayDelayMs(2), REVIEW_AUTOPLAY_MS / 2);
    assert.equal(reviewAutoplayDelayMs(0.5), REVIEW_AUTOPLAY_MS * 2);
  });
});
