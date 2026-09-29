import { Chess, type Square } from 'chess.js';

import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { uciMovesMatch } from './stockfishAnalysis';
import { parseUciMove } from './uciParse';

export function bestMoveArrowForReviewRecord(
  record: ClassifiedMoveRecord | null,
  displayFen?: string | null,
): { from: Square; to: Square } | null {
  if (!record || record.forced || record.wasBestMove) {
    return null;
  }
  if (!record.bestMoveUci) {
    return null;
  }
  if (uciMovesMatch(record.move, record.bestMoveUci)) {
    return null;
  }
  const parsed = parseUciMove(record.bestMoveUci);
  if (!parsed) {
    return null;
  }

  if (displayFen) {
    const board = new Chess(displayFen);
    const fromPiece = board.get(parsed.from);
    if (!fromPiece || fromPiece.color !== record.color) {
      return null;
    }
  }

  return { from: parsed.from, to: parsed.to };
}
