export const RECOMMENDED_CLASSIFICATION_MOVETIME_MS = 750;
export const CLASSIFICATION_MOVETIME_MIN_MS = 400;
export const CLASSIFICATION_MOVETIME_MAX_MS = 2_500;
export const CLASSIFICATION_MOVETIME_STEP_MS = 50;

export function clampClassificationMovetimeMs(value: number): number {
  const clamped = Math.min(
    CLASSIFICATION_MOVETIME_MAX_MS,
    Math.max(CLASSIFICATION_MOVETIME_MIN_MS, value),
  );
  const stepped =
    Math.round(clamped / CLASSIFICATION_MOVETIME_STEP_MS) * CLASSIFICATION_MOVETIME_STEP_MS;
  return Math.min(CLASSIFICATION_MOVETIME_MAX_MS, Math.max(CLASSIFICATION_MOVETIME_MIN_MS, stepped));
}

export function formatClassificationMovetimeLabel(movetimeMs: number): string {
  const seconds = movetimeMs / 1000;
  if (Number.isInteger(seconds)) {
    return `${seconds}s`;
  }
  return `${seconds.toFixed(2).replace(/\.?0+$/, '')}s`;
}

export function classificationMovetimeHint(movetimeMs: number): string {
  if (movetimeMs === RECOMMENDED_CLASSIFICATION_MOVETIME_MS) {
    return 'Recommended';
  }
  if (movetimeMs <= 500) {
    return 'Fast · less battery';
  }
  if (movetimeMs >= 1_500) {
    return 'Deep · more accurate, more battery';
  }
  return 'Balanced';
}

export function recommendedMarkLeftPercent(recommended: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return ((recommended - min) / (max - min)) * 100;
}

/** Matches DragSlider thumb diameter — keep in sync with components/DragSlider.tsx. */
export const SLIDER_THUMB_SIZE = 22;

/** Horizontal center of the slider thumb for a value, in track pixels. */
export function sliderThumbCenterX(
  value: number,
  min: number,
  max: number,
  trackWidth: number,
  thumbSize: number = SLIDER_THUMB_SIZE,
): number {
  if (trackWidth <= 0 || max <= min) {
    return 0;
  }
  const ratio = (value - min) / (max - min);
  return ratio * Math.max(0, trackWidth - thumbSize) + thumbSize / 2;
}
