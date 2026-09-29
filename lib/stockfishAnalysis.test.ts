import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ANALYSIS_MOVETIME_MS,
  analysisGoCommand,
  analysisTimeoutMs,
  depthMovetimeSearch,
  depthSearch,
  isSameSquarePromotion,
  LIVE_EVAL_SEARCH,
  movetimeSearch,
  reviewAnalysisTimeoutMs,
} from './stockfishAnalysis';
import {
  clampClassificationMovetimeMs,
  formatClassificationMovetimeLabel,
  RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
} from './classificationMovetime';

describe('analysis search modes', () => {
  it('uses movetime for live eval', () => {
    assert.equal(analysisGoCommand(LIVE_EVAL_SEARCH), `go movetime ${ANALYSIS_MOVETIME_MS}`);
    assert.equal(analysisTimeoutMs(LIVE_EVAL_SEARCH), ANALYSIS_MOVETIME_MS + 5_000);
  });

  it('builds classification movetime search commands', () => {
    const mode = movetimeSearch(1_500);
    assert.equal(analysisGoCommand(mode), 'go movetime 1500');
    assert.equal(analysisTimeoutMs(mode), 1_500 + 5_000);
  });

  it('caps post-game review searches with depth and movetime', () => {
    const mode = depthMovetimeSearch(18, 288);
    assert.equal(analysisGoCommand(mode), 'go depth 18 movetime 288');
    assert.equal(reviewAnalysisTimeoutMs(mode), 4_288);
  });

  it('uses a short timeout budget for post-game review searches', () => {
    assert.equal(reviewAnalysisTimeoutMs(depthSearch(18)), 8_000);
    assert.equal(reviewAnalysisTimeoutMs(movetimeSearch(2_500)), 6_500);
  });

  it('treats same-square promotions as equivalent squares', () => {
    assert.equal(isSameSquarePromotion('g7g8n', 'g7g8q'), true);
    assert.equal(isSameSquarePromotion('g7g8q', 'g7g8q'), false);
    assert.equal(isSameSquarePromotion('e2e4', 'e7e5'), false);
  });
});

describe('classification movetime prefs', () => {
  it('defaults recommended time to 750ms', () => {
    assert.equal(RECOMMENDED_CLASSIFICATION_MOVETIME_MS, 750);
  });

  it('clamps and steps slider values', () => {
    assert.equal(clampClassificationMovetimeMs(725), 750);
    assert.equal(clampClassificationMovetimeMs(100), 400);
    assert.equal(clampClassificationMovetimeMs(9_999), 2_500);
  });

  it('formats seconds for the settings label', () => {
    assert.equal(formatClassificationMovetimeLabel(750), '0.75s');
    assert.equal(formatClassificationMovetimeLabel(1500), '1.5s');
  });
});
