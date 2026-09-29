import { Chess } from 'chess.js';

import { fenSideToMove, type PositionAnalysis } from './stockfishAnalysis';

/** Centipawns from side-to-move when that side is checkmated (Stockfish mate-0 convention). */
export const MATED_SIDE_EVAL_CP = -100_000;

/**
 * Synthesize engine-style analysis for finished games so we do not rely on Stockfish
 * on positions with no legal moves (often returns cp 0 or ambiguous mate 0).
 */
export function getTerminalPositionAnalysis(fen: string): PositionAnalysis | null {
  try {
    const chess = new Chess(fen);
    if (!chess.isGameOver()) {
      return null;
    }

    const sideToMove = fenSideToMove(fen);

    if (chess.isCheckmate()) {
      return {
        fen,
        sideToMove,
        evalCentipawns: MATED_SIDE_EVAL_CP,
        bestMoveUci: '',
        scoreCp: null,
        scoreMate: 0,
      };
    }

    return {
      fen,
      sideToMove,
      evalCentipawns: 0,
      bestMoveUci: '',
      scoreCp: 0,
      scoreMate: null,
    };
  } catch {
    return null;
  }
}
