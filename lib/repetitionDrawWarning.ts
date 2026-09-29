import { Chess } from 'chess.js';

export const REPETITION_DRAW_WARNING_TEXT =
  'This position has occurred twice — repeat it again and the game is drawn.';

function startingFenForGame(chess: Chess): string {
  const probe = new Chess();
  probe.loadPgn(chess.pgn());
  while (probe.history().length > 0) {
    probe.undo();
  }
  return probe.fen();
}

/** How many times the current position hash appears in the game so far (including now). */
export function countCurrentPositionOccurrences(chess: Chess): number {
  const targetHash = chess.hash();
  const moves = chess.history();

  if (moves.length === 0) {
    return 1;
  }

  const replay = new Chess(startingFenForGame(chess));
  let count = 0;

  if (replay.hash() === targetHash) {
    count += 1;
  }

  for (const san of moves) {
    replay.move(san);
    if (replay.hash() === targetHash) {
      count += 1;
    }
  }

  return count;
}

/** True when one more occurrence of this position would end the game by threefold repetition. */
export function shouldShowRepetitionDrawWarning(chess: Chess): boolean {
  if (chess.isGameOver()) {
    return false;
  }

  return countCurrentPositionOccurrences(chess) >= 2;
}
