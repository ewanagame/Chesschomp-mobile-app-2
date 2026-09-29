import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { centipawnsToWinPercent, type MoveClassification } from './moveClassification';

export const REPORT_CLASSIFICATION_ORDER: readonly MoveClassification[] = [
  'Brilliant',
  'Great',
  'Best',
  'Excellent',
  'Good',
  'Book',
  'Forced',
  'Inaccuracy',
  'Mistake',
  'Blunder',
  'Miss',
  'MissedWin',
];

export type SideAccuracyStats = {
  accuracy: number;
  averageWinPercentLoss: number;
  moveCount: number;
  breakdown: Record<MoveClassification, number>;
};

export type AccuracyReportData = {
  white: SideAccuracyStats;
  black: SideAccuracyStats;
};

function emptyBreakdown(): Record<MoveClassification, number> {
  return {
    Brilliant: 0,
    Great: 0,
    Miss: 0,
    MissedWin: 0,
    Best: 0,
    Excellent: 0,
    Good: 0,
    Book: 0,
    Forced: 0,
    Inaccuracy: 0,
    Mistake: 0,
    Blunder: 0,
  };
}

const ACCURACY_EXCLUDED_CLASSIFICATIONS = new Set<MoveClassification>(['Forced']);

/** Win% lost on a move compared to the best available line (from stored evals). */
export function winPercentLossForMove(record: ClassifiedMoveRecord): number {
  if (ACCURACY_EXCLUDED_CLASSIFICATIONS.has(record.classification)) {
    return 0;
  }

  if (record.missedWin && record.bestMoveEval != null) {
    const winPercentBest = centipawnsToWinPercent(record.bestMoveEval);
    const winPercentAfter = centipawnsToWinPercent(record.evalAfter);
    return Math.max(0, winPercentBest - winPercentAfter);
  }

  const winPercentBefore = centipawnsToWinPercent(record.evalBefore);
  const winPercentAfter = centipawnsToWinPercent(record.evalAfter);
  return Math.max(0, winPercentBefore - winPercentAfter);
}

export function averageWinPercentLoss(moves: readonly ClassifiedMoveRecord[]): number {
  if (moves.length === 0) {
    return 0;
  }

  const total = moves.reduce((sum, move) => sum + winPercentLossForMove(move), 0);
  return total / moves.length;
}

/** Lichess-style accuracy approximation from average win% loss (ACPL proxy). */
export function accuracyFromAverageLoss(averageLoss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * averageLoss) - 3.1668;
  return Math.max(0, Math.min(100, raw));
}

export function buildSideAccuracyStats(
  moves: readonly ClassifiedMoveRecord[],
  color: 'w' | 'b',
): SideAccuracyStats {
  const sideMoves = moves.filter((move) => move.color === color);
  const breakdown = emptyBreakdown();

  for (const move of sideMoves) {
    breakdown[move.classification] += 1;
    if (move.missedWin) {
      breakdown.MissedWin += 1;
    }
  }

  const averageLoss = averageWinPercentLoss(sideMoves);

  return {
    accuracy: accuracyFromAverageLoss(averageLoss),
    averageWinPercentLoss: averageLoss,
    moveCount: sideMoves.length,
    breakdown,
  };
}

export function buildAccuracyReportData(
  moves: readonly ClassifiedMoveRecord[],
): AccuracyReportData {
  return {
    white: buildSideAccuracyStats(moves, 'w'),
    black: buildSideAccuracyStats(moves, 'b'),
  };
}

export function classificationDisplayName(classification: MoveClassification): string {
  if (classification === 'MissedWin') {
    return 'Missed Win';
  }
  return classification;
}

export function notableMovesFromReport(
  moves: readonly ClassifiedMoveRecord[],
): ClassifiedMoveRecord[] {
  return moves.filter((move) => move.forced || move.missedWin);
}
