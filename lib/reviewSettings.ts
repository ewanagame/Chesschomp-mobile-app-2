import { depthMovetimeSearch, type AnalysisSearchMode } from './stockfishAnalysis';

export const REVIEW_AUTOPLAY_MS = 450;

export const REVIEW_PLAYBACK_SPEED_MIN = 0.25;
export const REVIEW_PLAYBACK_SPEED_MAX = 2;
export const REVIEW_PLAYBACK_SPEED_STEP = 0.25;
export const DEFAULT_REVIEW_PLAYBACK_SPEED = 1;

export function clampReviewPlaybackSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return DEFAULT_REVIEW_PLAYBACK_SPEED;
  }

  const snapped =
    Math.round((speed - REVIEW_PLAYBACK_SPEED_MIN) / REVIEW_PLAYBACK_SPEED_STEP) *
      REVIEW_PLAYBACK_SPEED_STEP +
    REVIEW_PLAYBACK_SPEED_MIN;
  return Math.min(REVIEW_PLAYBACK_SPEED_MAX, Math.max(REVIEW_PLAYBACK_SPEED_MIN, snapped));
}

export function formatReviewPlaybackSpeedLabel(speed: number): string {
  const clamped = clampReviewPlaybackSpeed(speed);
  return `${Number(clamped.toFixed(2))}×`;
}

export function reviewAutoplayDelayMs(speed: number): number {
  return REVIEW_AUTOPLAY_MS / clampReviewPlaybackSpeed(speed);
}

export const REVIEW_DEPTH_MIN = 16;
export const REVIEW_DEPTH_MAX = 32;
export const REVIEW_DEPTH_STEP = 1;
export const RECOMMENDED_REVIEW_DEPTH = 18;

/** Bump when review search or classification rules change so saved evals re-run. */
export const REVIEW_ANALYSIS_VERSION = 2;

export function clampReviewDepth(depth: number): number {
  const rounded = Math.round(depth);
  return Math.min(REVIEW_DEPTH_MAX, Math.max(REVIEW_DEPTH_MIN, rounded));
}

export function formatReviewDepthLabel(depth: number): string {
  return `Depth ${clampReviewDepth(depth)}`;
}

/** Per-search think cap so a ~50-move game finishes around a minute. */
export function reviewMovetimeMsForDepth(depth: number): number {
  const clamped = clampReviewDepth(depth);
  return Math.min(750, Math.max(250, clamped * 16));
}

export function reviewSearchForDepth(depth: number): AnalysisSearchMode {
  const clamped = clampReviewDepth(depth);
  return depthMovetimeSearch(clamped, reviewMovetimeMsForDepth(clamped));
}

/** Rough seconds per ply at a given depth on mobile WASM Stockfish. */
export function estimatedSecondsPerPly(depth: number): number {
  const searchSeconds = reviewMovetimeMsForDepth(depth) / 1000;
  // Two searches per ply (before MultiPV + after), plus WASM overhead.
  return searchSeconds * 2 * 1.2;
}

export function estimateReviewDurationSeconds(depth: number, plyCount: number): number {
  if (plyCount <= 0) {
    return 0;
  }
  return Math.ceil(estimatedSecondsPerPly(depth) * plyCount);
}

export function formatReviewDurationEstimate(seconds: number): string {
  if (seconds < 60) {
    return `~${seconds}s`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? '~1 min' : `~${minutes} min`;
}

export function reviewDepthHint(depth: number, plyCount: number): string {
  const estimate = formatReviewDurationEstimate(estimateReviewDurationSeconds(depth, plyCount));
  return `Higher depth is more accurate but slower. ${estimate} for ${plyCount} moves.`;
}

export function isReusableCachedReview<T extends { analysisVersion?: number; classifiedMoves: readonly unknown[] }>(
  cached: T | null | undefined,
  moveCount: number,
): cached is T {
  return (
    cached != null &&
    cached.analysisVersion === REVIEW_ANALYSIS_VERSION &&
    cached.classifiedMoves.length === moveCount &&
    moveCount > 0
  );
}
