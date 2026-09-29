import { reviewSearchForDepth } from './reviewSettings';
import { movetimeSearch, type AnalysisSearchMode } from './stockfishAnalysis';

const REVIEW_MIN_FALLBACK_MOVETIME_MS = 250;

/** One time-capped retry when a review search hangs — never re-run unbounded depth. */
export function reviewAnalysisFallbackModes(primary: AnalysisSearchMode): AnalysisSearchMode[] {
  if (primary.kind === 'depth') {
    return [reviewSearchForDepth(primary.depth), movetimeSearch(REVIEW_MIN_FALLBACK_MOVETIME_MS)];
  }

  if (primary.kind === 'depthMovetime') {
    const softer = Math.max(
      REVIEW_MIN_FALLBACK_MOVETIME_MS,
      Math.round(primary.movetimeMs * 0.75),
    );
    if (softer >= primary.movetimeMs) {
      return [primary];
    }
    return [primary, movetimeSearch(softer)];
  }

  return [primary];
}
