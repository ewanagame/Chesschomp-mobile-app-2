import type { Chess, Move, Square } from 'chess.js';

import { isForcedMove } from './forcedMove';
import { isMaterialSacrifice } from './materialEval';
import { moveToUci, uciMovesMatch, type PositionAnalysis } from './stockfishAnalysis';

export type EasterEggCandidate = {
  from: Square;
  to: Square;
  move: Move;
  isMaterialSacrifice: boolean;
};

export type EasterEggTarget = {
  from: Square;
  to: Square;
  tier: 'Brilliant' | 'Great';
};

/** Sync phase: does this piece have a non-promotion best-move candidate worth prefetching? */
export function findEasterEggCandidateSync(
  fenBefore: string,
  from: Square,
  cachedAnalysis: PositionAnalysis | null,
  game: Chess,
): EasterEggCandidate | null {
  if (isForcedMove(fenBefore)) {
    return null;
  }

  if (!cachedAnalysis || cachedAnalysis.fen !== fenBefore || !cachedAnalysis.bestMoveUci) {
    return null;
  }

  const moves = game.moves({ square: from, verbose: true });
  const bestMove = moves.find((candidate) =>
    uciMovesMatch(moveToUci(candidate), cachedAnalysis.bestMoveUci),
  );

  if (!bestMove || bestMove.isPromotion()) {
    return null;
  }

  const materialSacrifice = isMaterialSacrifice(
    fenBefore,
    bestMove.after,
    bestMove,
    bestMove.color,
  );

  return {
    from,
    to: bestMove.to,
    move: bestMove,
    isMaterialSacrifice: materialSacrifice,
  };
}
