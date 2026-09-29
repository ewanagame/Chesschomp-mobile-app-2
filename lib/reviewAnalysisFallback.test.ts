import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reviewAnalysisFallbackModes } from './reviewAnalysisFallback';
import { reviewSearchForDepth } from './reviewSettings';
import { depthMovetimeSearch, depthSearch, movetimeSearch } from './stockfishAnalysis';

describe('reviewAnalysisFallbackModes', () => {
  it('converts unbounded depth search into a time-capped review search', () => {
    assert.deepEqual(reviewAnalysisFallbackModes(depthSearch(18)), [
      reviewSearchForDepth(18),
      movetimeSearch(250),
    ]);
  });

  it('retries a slightly shorter movetime when a depth+movetime search hangs', () => {
    assert.deepEqual(reviewAnalysisFallbackModes(depthMovetimeSearch(18, 288)), [
      depthMovetimeSearch(18, 288),
      movetimeSearch(250),
    ]);
  });

  it('keeps movetime-only search as a single attempt', () => {
    assert.deepEqual(
      reviewAnalysisFallbackModes(movetimeSearch(1_500)),
      [movetimeSearch(1_500)],
    );
  });
});
