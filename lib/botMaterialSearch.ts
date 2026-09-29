import { Chess, SQUARES, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

import type { BotMove } from './botOpponent';

export const MATERIAL_VALUES = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 0,
} as const satisfies Record<PieceSymbol, number>;

export const KNIGHT_CENTER_BONUS = 10;
export const PAWN_ADVANCE_BONUS_PER_RANK = 5;
export const MATE_SCORE = 100_000;

export const TIER_600_CALIBRATION = {
  elo: 600,
  searchDepth: 2,
  bestMoveProbability: 0.7,
  materialValues: MATERIAL_VALUES,
  knightCenterBonus: KNIGHT_CENTER_BONUS,
  pawnAdvanceBonusPerRank: PAWN_ADVANCE_BONUS_PER_RANK,
} as const;

const CENTER_FILES = new Set(['c', 'd', 'e', 'f']);
const CENTER_RANKS = new Set(['3', '4', '5', '6']);

export type RankedBotMove = {
  move: BotMove;
  score: number;
};

export function moveToBotMove(move: Move): BotMove {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  };
}

function pieceSquareBonus(piece: { type: PieceSymbol; color: Color }, square: Square): number {
  let bonus = 0;

  if (
    piece.type === 'n' &&
    CENTER_FILES.has(square[0]) &&
    CENTER_RANKS.has(square[1])
  ) {
    bonus += KNIGHT_CENTER_BONUS;
  }

  if (piece.type === 'p') {
    const rank = Number.parseInt(square[1], 10);
    const advance = piece.color === 'w' ? rank - 1 : 8 - rank;
    bonus += advance * PAWN_ADVANCE_BONUS_PER_RANK;
  }

  return bonus;
}

/** Material + terminal game-result scoring from `perspective`'s point of view. */
export function evaluateMaterialPosition(fen: string, perspective: Color): number {
  const chess = new Chess(fen);

  if (chess.isCheckmate()) {
    return chess.turn() === perspective ? -MATE_SCORE : MATE_SCORE;
  }

  if (chess.isStalemate() || chess.isDraw()) {
    return 0;
  }

  let score = 0;

  for (const square of SQUARES) {
    const piece = chess.get(square);
    if (!piece) {
      continue;
    }

    const material = MATERIAL_VALUES[piece.type];
    const bonus = pieceSquareBonus(piece, square);
    const total = material + bonus;
    score += piece.color === perspective ? total : -total;
  }

  return score;
}

/** True if the side to move in `fen` has a checkmating move available. */
export function sideToMoveHasMateInOne(fen: string): boolean {
  const chess = new Chess(fen);
  for (const move of chess.moves({ verbose: true })) {
    const trial = new Chess(fen);
    trial.move(move);
    if (trial.isCheckmate()) {
      return true;
    }
  }
  return false;
}

function oppositeColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function minimax(fen: string, depth: number, perspective: Color, sideToMove: Color): number {
  const chess = new Chess(fen);
  if (depth === 0 || chess.isGameOver()) {
    return evaluateMaterialPosition(fen, perspective);
  }

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return evaluateMaterialPosition(fen, perspective);
  }

  const maximizing = sideToMove === perspective;
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const move of moves) {
    const trial = new Chess(fen);
    trial.move(move);
    const score = minimax(trial.fen(), depth - 1, perspective, oppositeColor(sideToMove));
    best = maximizing ? Math.max(best, score) : Math.min(best, score);
  }

  return best;
}

function scoreMaterialMove(
  fen: string,
  move: Move,
  depth: number,
  perspective: Color,
): number {
  const chess = new Chess(fen);
  const sideToMove = chess.turn();
  chess.move(move);

  if (depth <= 1) {
    return evaluateMaterialPosition(chess.fen(), perspective);
  }

  return minimax(chess.fen(), depth - 1, perspective, oppositeColor(sideToMove));
}

/** Rank legal moves by material search, optionally jittered by eval noise. */
export function rankMaterialMoves(
  fen: string,
  depth: number,
  perspective: Color,
  evalNoise = 0,
): RankedBotMove[] {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });

  const ranked = legalMoves.map((move) => {
    const score = scoreMaterialMove(fen, move, depth, perspective);
    const noise = evalNoise > 0 ? (Math.random() * 2 - 1) * evalNoise : 0;
    return {
      move: moveToBotMove(move),
      score: score + noise,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function pickSuboptimalMaterialMove(fen: string, depth: number, perspective: Color): BotMove | null {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) {
    return null;
  }

  const ranked = rankMaterialMoves(fen, depth, perspective, 0);
  const bestMove = ranked[0]?.move;
  if (!bestMove) {
    return null;
  }

  const nonBest = legalMoves.filter(
    (move) =>
      !(
        move.from === bestMove.from &&
        move.to === bestMove.to &&
        move.promotion === bestMove.promotion
      ),
  );

  if (nonBest.length === 0) {
    return bestMove;
  }

  if (Math.random() < 0.5) {
    return moveToBotMove(nonBest[Math.floor(Math.random() * nonBest.length)]);
  }

  let worstScore = Number.POSITIVE_INFINITY;
  let worstMoves: Move[] = [];

  for (const move of nonBest) {
    const trial = new Chess(fen);
    trial.move(move);
    const score = evaluateMaterialPosition(trial.fen(), perspective);
    if (score < worstScore) {
      worstScore = score;
      worstMoves = [move];
    } else if (score === worstScore) {
      worstMoves.push(move);
    }
  }

  return moveToBotMove(worstMoves[Math.floor(Math.random() * worstMoves.length)]);
}

/** ~600 Elo: 70% best 2-ply material line, 30% deliberate suboptimal blunder. Pure JS — no Stockfish. */
export function chooseTier600Move(fen: string): BotMove | null {
  const chess = new Chess(fen);
  const botColor = chess.turn();
  const legalMoves = chess.moves({ verbose: true });

  if (legalMoves.length === 0) {
    return null;
  }

  if (legalMoves.length === 1) {
    return moveToBotMove(legalMoves[0]);
  }

  if (Math.random() >= TIER_600_CALIBRATION.bestMoveProbability) {
    return pickSuboptimalMaterialMove(
      fen,
      TIER_600_CALIBRATION.searchDepth,
      botColor,
    );
  }

  const ranked = rankMaterialMoves(
    fen,
    TIER_600_CALIBRATION.searchDepth,
    botColor,
    0,
  );
  return ranked[0]?.move ?? moveToBotMove(legalMoves[0]);
}
