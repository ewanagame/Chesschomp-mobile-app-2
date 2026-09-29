import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Display order: chess.com-style left-to-right grouping (kings never captured). */
export const CAPTURED_PIECE_DISPLAY_ORDER: PieceSymbol[] = ['p', 'b', 'n', 'r', 'q'];

export type CaptureCounts = Partial<Record<PieceSymbol, number>>;

export type SideCaptures = {
  counts: CaptureCounts;
  materialValue: number;
};

export type CapturedMaterial = {
  white: SideCaptures;
  black: SideCaptures;
  /** Which side leads in captured material, and by how many points. Null if tied. */
  advantage: { side: Color; points: number } | null;
};

export const CAPTURED_PIECES_BAR_HEIGHT = 34;
export const BOARD_SIDE_AVATAR_SIZE = 40;
export const BOARD_SIDE_AVATAR_GAP = 8;
export const CAPTURE_ROW_HEIGHT = Math.max(
  CAPTURED_PIECES_BAR_HEIGHT,
  BOARD_SIDE_AVATAR_SIZE,
);

/** Gray strip beside the portrait (icons + name share this width). */
export function capturedPiecesBarWidth(boardSize: number): number {
  return Math.max(0, boardSize - BOARD_SIDE_AVATAR_SIZE - BOARD_SIDE_AVATAR_GAP);
}

export function expandCapturedPieceIcons(counts: CaptureCounts): PieceSymbol[] {
  return CAPTURED_PIECE_DISPLAY_ORDER.flatMap((type) =>
    Array.from({ length: counts[type] ?? 0 }, () => type),
  );
}

function emptySideCaptures(): SideCaptures {
  return { counts: {}, materialValue: 0 };
}

export function computeCapturedMaterialFromMoves(moves: readonly Move[]): CapturedMaterial {
  const white = emptySideCaptures();
  const black = emptySideCaptures();

  for (const move of moves) {
    if (!move.captured) {
      continue;
    }

    const side = move.color === 'w' ? white : black;
    side.counts[move.captured] = (side.counts[move.captured] ?? 0) + 1;
    side.materialValue += PIECE_VALUES[move.captured];
  }

  let advantage: CapturedMaterial['advantage'] = null;
  const diff = white.materialValue - black.materialValue;
  if (diff > 0) {
    advantage = { side: 'w', points: diff };
  } else if (diff < 0) {
    advantage = { side: 'b', points: -diff };
  }

  return { white, black, advantage };
}

export function computeCapturedMaterial(game: Chess): CapturedMaterial {
  return computeCapturedMaterialFromMoves(game.history({ verbose: true }));
}

/** Replay SAN through the viewed ply. Works when the board Chess is a FEN-only clone. */
export function computeCapturedMaterialFromSans(sans: readonly string[]): CapturedMaterial {
  const chess = new Chess();
  const verbose: Move[] = [];
  for (const san of sans) {
    const result = chess.move(san);
    if (!result) {
      break;
    }
    verbose.push(result);
  }
  return computeCapturedMaterialFromMoves(verbose);
}

/** Visual top of the board for the current orientation (opponent home rank). */
export function visualTopColor(orientation: 'white' | 'black'): Color {
  return orientation === 'white' ? 'b' : 'w';
}

export function visualBottomColor(orientation: 'white' | 'black'): Color {
  return orientation === 'white' ? 'w' : 'b';
}

/** Icons show the captured piece type in the captured side's color. */
export function capturedPieceDisplayColor(captor: Color): Color {
  return captor === 'w' ? 'b' : 'w';
}
