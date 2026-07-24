import type { Color } from 'chess.js';

import type { SearchInfo } from './uciParse';

export type PositionAnalysis = {
  fen: string;
  sideToMove: Color;
  evalCentipawns: number;
  bestMoveUci: string;
};

export type MultiPvLine = {
  multipv: number;
  evalCentipawns: number;
  pv: string[];
};

export type MultiPvAnalysis = {
  fen: string;
  sideToMove: Color;
  lines: MultiPvLine[];
};

export const ANALYSIS_MOVETIME_MS = 750;

export function fenSideToMove(fen: string): Color {
  const side = fen.split(/\s+/)[1];
  return side === 'b' ? 'b' : 'w';
}

export function moveToUci(move: { from: string; to: string; promotion?: string | null }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/** Convert UCI info score to centipawns from side-to-move perspective. */
export function scoreToCentipawns(info: SearchInfo | null): number {
  if (!info) {
    return 0;
  }
  if (info.scoreCp != null) {
    return info.scoreCp;
  }
  if (info.scoreMate != null) {
    const sign = info.scoreMate > 0 ? 1 : -1;
    return sign * (100_000 - Math.abs(info.scoreMate) * 1_000);
  }
  return 0;
}

/**
 * Stockfish reports eval from side-to-move. Re-express as centipawns for a specific player.
 * If that player is to move in this position, use the score as-is; otherwise flip sign.
 */
export function evalCentipawnsForMover(analysis: PositionAnalysis, mover: Color): number {
  return analysis.sideToMove === mover ? analysis.evalCentipawns : -analysis.evalCentipawns;
}

export function uciMovesMatch(playedUci: string, bestUci: string): boolean {
  return playedUci.toLowerCase() === bestUci.toLowerCase();
}

/** Win% gap between Stockfish's #1 and #2 lines from the mover's perspective. */
export function bestSecondWinPercentGap(
  analysis: MultiPvAnalysis,
  mover: Color,
  centipawnsToWinPercent: (cp: number) => number,
): number {
  const line1 = analysis.lines.find((line) => line.multipv === 1);
  const line2 = analysis.lines.find((line) => line.multipv === 2);
  if (!line1 || !line2) {
    return 0;
  }

  const cp1 =
    analysis.sideToMove === mover ? line1.evalCentipawns : -line1.evalCentipawns;
  const cp2 =
    analysis.sideToMove === mover ? line2.evalCentipawns : -line2.evalCentipawns;

  return centipawnsToWinPercent(cp1) - centipawnsToWinPercent(cp2);
}
