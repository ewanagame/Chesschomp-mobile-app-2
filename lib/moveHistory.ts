/** Format chess.js history() as "1. e4 e5 2. Nf3 ..." */
export function formatMoveHistory(history: readonly string[]): string {
  if (history.length === 0) {
    return '';
  }

  const parts: string[] = [];
  for (let index = 0; index < history.length; index += 2) {
    const moveNumber = index / 2 + 1;
    const whiteMove = history[index];
    const blackMove = history[index + 1];
    parts.push(blackMove ? `${moveNumber}. ${whiteMove} ${blackMove}` : `${moveNumber}. ${whiteMove}`);
  }

  return parts.join('  ');
}

export type MoveHistoryRow = {
  moveNumber: number;
  white?: { plyIndex: number; san: string };
  black?: { plyIndex: number; san: string };
};

export function buildMoveHistoryRows(moves: readonly string[]): MoveHistoryRow[] {
  const rows: MoveHistoryRow[] = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      moveNumber: index / 2 + 1,
      white: { plyIndex: index, san: moves[index]! },
      black: moves[index + 1]
        ? { plyIndex: index + 1, san: moves[index + 1]! }
        : undefined,
    });
  }
  return rows;
}

/** Piece letter prefix in SAN; pawns (and promotions) return null. */
export function pieceTypeFromSan(san: string): 'n' | 'b' | 'r' | 'q' | 'k' | null {
  if (/^O-O/i.test(san)) {
    return 'k';
  }

  switch (san[0]) {
    case 'N':
      return 'n';
    case 'B':
      return 'b';
    case 'R':
      return 'r';
    case 'Q':
      return 'q';
    case 'K':
      return 'k';
    default:
      return null;
  }
}
