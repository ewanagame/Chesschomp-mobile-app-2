export const ANALYSIS_CANCELLED = 'Stockfish analysis cancelled';

export type RegisterAnalysisCancel = (cancel: () => void) => () => void;

export function isAnalysisCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === ANALYSIS_CANCELLED;
}
