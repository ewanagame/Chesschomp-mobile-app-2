import { getOpeningBook } from './openingBook';

export function formatReviewAnalysisError(
  error: unknown,
  completed: number,
  total: number,
): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('timed out')) {
    if (completed <= 0) {
      return `Analysis timed out on move 1 of ${total}. Tap Retry to try again.`;
    }
    if (completed >= total) {
      return 'Analysis timed out. Tap Retry to try again.';
    }
    return `Analysis stopped at move ${completed} of ${total}. Tap Retry to continue.`;
  }
  return message;
}

export function reviewBookStateBeforePly(
  moves: readonly string[],
  plyIndex: number,
): { gameSanMoves: string[]; hasLeftBook: boolean } {
  const openingBook = getOpeningBook();
  const gameSanMoves: string[] = [];
  let hasLeftBook = false;

  for (let index = 0; index < plyIndex; index += 1) {
    const san = moves[index];
    if (!san) {
      break;
    }
    gameSanMoves.push(san);
    if (!hasLeftBook && !openingBook.isSequenceInBook(gameSanMoves)) {
      hasLeftBook = true;
    }
  }

  return { gameSanMoves, hasLeftBook };
}
