import { type LivePositionEval } from './liveEval';

export function formatEvalLabel(evalState: LivePositionEval): string {
  if (evalState.isNeutral) {
    return '0.0';
  }

  if (evalState.mateInWhite != null) {
    return `M${Math.abs(evalState.mateInWhite)}`;
  }

  const magnitude = (Math.abs(evalState.centipawnsWhite) / 100).toFixed(1);
  return `+${magnitude}`;
}
