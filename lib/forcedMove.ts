import { Chess } from 'chess.js';

/** True when the side to move had exactly one legal move in this position. */
export function isForcedMove(fenBefore: string): boolean {
  try {
    const position = new Chess(fenBefore);
    return position.moves().length === 1;
  } catch {
    return false;
  }
}
