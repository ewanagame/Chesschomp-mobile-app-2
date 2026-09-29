import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import {
  evalCentipawnsForMover,
  type PositionAnalysis,
} from './stockfishAnalysis';
import {
  centipawnsToWinPercent,
  MISSED_WIN_CP_DROP_THRESHOLD,
  MISSED_WIN_CP_THRESHOLD,
  MISSED_WIN_WIN_PERCENT_DROP,
} from '../utils/moveClassification';

export type MissedWinResult = {
  missedWin: boolean;
  detail: string | null;
  bestMoveEval: number | null;
  evalDelta: number | null;
};

export function fenAfterUci(fen: string, uci: string): string | null {
  if (!uci || uci.length < 4) {
    return null;
  }

  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: (uci[4] as PieceSymbol | undefined) ?? undefined,
    });
    return move ? chess.fen() : null;
  } catch {
    return null;
  }
}

export function moverWinningMatePlies(analysis: PositionAnalysis, mover: Color): number | null {
  if (analysis.scoreMate == null) {
    return null;
  }

  const mate =
    analysis.sideToMove === mover ? analysis.scoreMate : -analysis.scoreMate;
  return mate > 0 ? mate : null;
}

/** Mate plies available to the opponent after the mover's played line (self-inflicted). */
export function opponentWinningMatePlies(
  analysis: PositionAnalysis,
  mover: Color,
): number | null {
  if (analysis.scoreMate == null) {
    return null;
  }

  const opponent: Color = mover === 'w' ? 'b' : 'w';
  if (analysis.sideToMove === opponent && analysis.scoreMate > 0) {
    return analysis.scoreMate;
  }
  if (analysis.sideToMove === mover && analysis.scoreMate < 0) {
    return Math.abs(analysis.scoreMate);
  }
  return null;
}

function formatCentipawns(centipawns: number): string {
  const pawns = centipawns / 100;
  return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

function formatMissedWinCpDetail(bestEval: number, playedEval: number): string {
  return `Missed a winning opportunity, eval dropped from ${formatCentipawns(bestEval)} to ${formatCentipawns(playedEval)}`;
}

/**
 * Step 1 — Missed Win detection (independent of move-quality bucketing).
 *
 * Compares the engine's best available line before the move vs the eval after the played move.
 * Can be true even when the played move is also a Blunder (e.g. had mate, hung own king).
 */
export function detectMissedWin(params: {
  beforeAnalysis: PositionAnalysis;
  bestMoveAfterAnalysis: PositionAnalysis | null;
  afterAnalysis: PositionAnalysis;
  mover: Color;
  wasBestMove: boolean;
  deliveredCheckmate: boolean;
}): MissedWinResult {
  const {
    beforeAnalysis,
    bestMoveAfterAnalysis,
    afterAnalysis,
    mover,
    wasBestMove,
    deliveredCheckmate,
  } = params;

  const empty: MissedWinResult = {
    missedWin: false,
    detail: null,
    bestMoveEval: null,
    evalDelta: null,
  };

  if (wasBestMove || deliveredCheckmate) {
    return empty;
  }

  const playedEval = evalCentipawnsForMover(afterAnalysis, mover);
  const bestEval = bestMoveAfterAnalysis
    ? evalCentipawnsForMover(bestMoveAfterAnalysis, mover)
    : evalCentipawnsForMover(beforeAnalysis, mover);

  const mateBefore = moverWinningMatePlies(beforeAnalysis, mover);
  if (mateBefore != null) {
    const mateAfter = moverWinningMatePlies(afterAnalysis, mover);
    if (mateAfter == null || mateAfter > mateBefore) {
      return {
        missedWin: true,
        detail: `Missed a forced mate in ${mateBefore}`,
        bestMoveEval: bestEval,
        evalDelta: bestEval - playedEval,
      };
    }
  }

  if (bestEval >= MISSED_WIN_CP_THRESHOLD) {
    const cpDrop = bestEval - playedEval;
    const winDrop =
      centipawnsToWinPercent(bestEval) - centipawnsToWinPercent(playedEval);

    if (cpDrop >= MISSED_WIN_CP_DROP_THRESHOLD || winDrop >= MISSED_WIN_WIN_PERCENT_DROP) {
      return {
        missedWin: true,
        detail: formatMissedWinCpDetail(bestEval, playedEval),
        bestMoveEval: bestEval,
        evalDelta: cpDrop,
      };
    }
  }

  return {
    missedWin: false,
    detail: null,
    bestMoveEval: bestEval,
    evalDelta: null,
  };
}
