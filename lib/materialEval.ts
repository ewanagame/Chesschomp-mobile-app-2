import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function countMaterial(chess: Chess, color: Color): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.color === color) {
        total += PIECE_VALUES[piece.type];
      }
    }
  }
  return total;
}

/**
 * Detect whether a best move intentionally gives up material compared to the pre-move
 * position — not a simple equal trade.
 *
 * Compares the mover's material before the move to after the opponent's cheapest legal
 * recapture on the destination square. The net loss minus any material gained on the
 * move itself must be at least 2 points.
 */
export function isMaterialSacrifice(
  fenBefore: string,
  fenAfter: string,
  move: Move,
  mover: Color,
): boolean {
  const chessBefore = new Chess(fenBefore);
  const materialBefore = countMaterial(chessBefore, mover);

  const chessAfter = new Chess(fenAfter);
  const materialAfterOnBoard = countMaterial(chessAfter, mover);
  if (materialBefore - materialAfterOnBoard >= 2) {
    return true;
  }

  const capturedGain = move.captured ? PIECE_VALUES[move.captured as PieceSymbol] : 0;
  const opponentRecaptures = chessAfter
    .moves({ verbose: true })
    .filter(
      (candidate) =>
        candidate.color !== mover && candidate.to === move.to && Boolean(candidate.captured),
    );

  if (opponentRecaptures.length === 0) {
    return false;
  }

  let maxNetLoss = 0;
  for (const recapture of opponentRecaptures) {
    const trial = new Chess(fenAfter);
    trial.move(recapture);
    maxNetLoss = Math.max(maxNetLoss, materialBefore - countMaterial(trial, mover));
  }

  return maxNetLoss - capturedGain >= 2;
}
