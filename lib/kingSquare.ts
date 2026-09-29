import type { Chess, Color, Square } from 'chess.js';

export function findKingSquare(chess: Chess, color: Color): Square | null {
  const board = chess.board();

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const piece = board[rankIndex][fileIndex];
      if (piece?.type === 'k' && piece.color === color) {
        const file = String.fromCharCode('a'.charCodeAt(0) + fileIndex);
        const rank = 8 - rankIndex;
        return `${file}${rank}` as Square;
      }
    }
  }

  return null;
}

/** After checkmate, the side to move is the mated player. */
export function winnerColorAfterCheckmate(chess: Chess): Color {
  return chess.turn() === 'w' ? 'b' : 'w';
}
