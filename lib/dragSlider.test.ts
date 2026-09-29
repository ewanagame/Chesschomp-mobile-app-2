import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLASSIFICATION_MOVETIME_MAX_MS,
  CLASSIFICATION_MOVETIME_MIN_MS,
  RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
  recommendedMarkLeftPercent,
  sliderThumbCenterX,
} from './classificationMovetime';

describe('DragSlider helpers', () => {
  it('places the recommended mark between fast and deep', () => {
    const left = recommendedMarkLeftPercent(
      RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
      CLASSIFICATION_MOVETIME_MIN_MS,
      CLASSIFICATION_MOVETIME_MAX_MS,
    );
    assert.ok(left > 10 && left < 40);
  });

  it('centers the recommended tick under the thumb at 750ms', () => {
    const trackWidth = 320;
    const center = sliderThumbCenterX(
      RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
      CLASSIFICATION_MOVETIME_MIN_MS,
      CLASSIFICATION_MOVETIME_MAX_MS,
      trackWidth,
    );
    assert.ok(center > 40 && center < 80);
    assert.ok(center < trackWidth * 0.25);
  });
});
