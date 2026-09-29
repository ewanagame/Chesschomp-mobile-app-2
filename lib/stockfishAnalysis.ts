import type { Color } from 'chess.js';

import type { SearchInfo } from './uciParse';

export type PositionAnalysis = {
  fen: string;
  sideToMove: Color;
  evalCentipawns: number;
  bestMoveUci: string;
  scoreCp?: number | null;
  scoreMate?: number | null;
};

export type MultiPvLine = {
  multipv: number;
  evalCentipawns: number;
  pv: string[];
  scoreCp?: number | null;
  scoreMate?: number | null;
};

export type MultiPvAnalysis = {
  fen: string;
  sideToMove: Color;
  lines: MultiPvLine[];
};

export const ANALYSIS_MOVETIME_MS = 750;

export type AnalysisSearchMode =
  | { kind: 'movetime'; movetimeMs: number }
  | { kind: 'depth'; depth: number }
  | { kind: 'depthMovetime'; depth: number; movetimeMs: number };

export const LIVE_EVAL_SEARCH: AnalysisSearchMode = {
  kind: 'movetime',
  movetimeMs: ANALYSIS_MOVETIME_MS,
};

export function movetimeSearch(movetimeMs: number): AnalysisSearchMode {
  return { kind: 'movetime', movetimeMs };
}

export function depthSearch(depth: number): AnalysisSearchMode {
  return { kind: 'depth', depth };
}

export function depthMovetimeSearch(depth: number, movetimeMs: number): AnalysisSearchMode {
  return { kind: 'depthMovetime', depth, movetimeMs };
}

function searchMovetimeMs(mode: AnalysisSearchMode): number | null {
  if (mode.kind === 'movetime' || mode.kind === 'depthMovetime') {
    return mode.movetimeMs;
  }
  return null;
}

export function analysisGoCommand(mode: AnalysisSearchMode): string {
  if (mode.kind === 'depthMovetime') {
    return `go depth ${mode.depth} movetime ${mode.movetimeMs}`;
  }
  if (mode.kind === 'depth') {
    return `go depth ${mode.depth}`;
  }
  return `go movetime ${mode.movetimeMs}`;
}

export function analysisTimeoutMs(mode: AnalysisSearchMode): number {
  const movetimeMs = searchMovetimeMs(mode);
  if (movetimeMs != null) {
    return movetimeMs + 5_000;
  }
  return Math.max(15_000, mode.kind === 'depth' ? mode.depth * 2_000 : 15_000);
}

/** Wall-clock budget for post-game evaluation. Time-capped searches should not wait minutes. */
export function reviewAnalysisTimeoutMs(mode: AnalysisSearchMode): number {
  const movetimeMs = searchMovetimeMs(mode);
  if (movetimeMs != null) {
    return movetimeMs + 4_000;
  }
  return Math.max(8_000, mode.kind === 'depth' ? mode.depth * 400 : 8_000);
}

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

/** Re-express a UCI score as centipawns for `color`. Returns null when no score is available. */
export function evalCentipawnsForColor(
  fen: string,
  color: Color,
  info: SearchInfo | null,
): number | null {
  if (!info || (info.scoreCp == null && info.scoreMate == null)) {
    return null;
  }
  const sideToMove = fenSideToMove(fen);
  const evalCentipawns = scoreToCentipawns(info);
  return sideToMove === color ? evalCentipawns : -evalCentipawns;
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

/** True when both UCIs promote on the same square to different pieces (e.g. g7g8n vs g7g8q). */
export function isSameSquarePromotion(playedUci: string, bestUci: string): boolean {
  const played = playedUci.toLowerCase();
  const best = bestUci.toLowerCase();
  return (
    played.length >= 5 &&
    best.length >= 5 &&
    played.slice(0, 4) === best.slice(0, 4) &&
    played.slice(4) !== best.slice(4)
  );
}

export function positionAnalysisFromMultiPv(analysis: MultiPvAnalysis): PositionAnalysis {
  const line1 = analysis.lines.find((line) => line.multipv === 1) ?? analysis.lines[0];
  return {
    fen: analysis.fen,
    sideToMove: analysis.sideToMove,
    evalCentipawns: line1?.evalCentipawns ?? 0,
    bestMoveUci: line1?.pv[0] ?? '',
    scoreCp: line1?.scoreCp ?? null,
    scoreMate: line1?.scoreMate ?? null,
  };
}

/** Convert cached Stockfish analysis to a White-perspective eval for UI display. */
export function liveEvalFromAnalysis(analysis: PositionAnalysis): {
  centipawnsWhite: number;
  mateInWhite: number | null;
} {
  const flip = analysis.sideToMove === 'w' ? 1 : -1;

  if (analysis.scoreMate != null) {
    // Mate 0 = side to move is already mated (Stockfish convention).
    const mateInWhite =
      analysis.scoreMate === 0
        ? analysis.sideToMove === 'w'
          ? -1
          : 1
        : analysis.scoreMate * flip;

    return {
      centipawnsWhite: 0,
      mateInWhite,
    };
  }

  const centipawns =
    analysis.scoreCp != null ? analysis.scoreCp * flip : analysis.evalCentipawns * flip;

  return {
    centipawnsWhite: centipawns,
    mateInWhite: null,
  };
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
