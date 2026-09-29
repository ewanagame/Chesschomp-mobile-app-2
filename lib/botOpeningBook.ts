import { Chess } from 'chess.js';

import type { BotMove } from './botOpponent';
import { moveToBotMove } from './botMaterialSearch';
import { getOpeningBook } from './openingBook';

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]+$/g, '');
}

/** Pick a random in-book continuation when one exists; otherwise null. */
export function pickOpeningBookMove(fen: string, sanMoves: readonly string[]): BotMove | null {
  if (!getOpeningBook().isSequenceInBook(sanMoves)) {
    return null;
  }

  const continuations = getOpeningBook().getBookContinuations(sanMoves);
  if (continuations.length === 0) {
    return null;
  }

  const chess = new Chess(fen);
  const continuationSet = new Set(continuations);
  const bookLegal = chess.moves({ verbose: true }).filter((move) =>
    continuationSet.has(normalizeSan(move.san)),
  );

  if (bookLegal.length === 0) {
    return null;
  }

  return moveToBotMove(bookLegal[Math.floor(Math.random() * bookLegal.length)]);
}
