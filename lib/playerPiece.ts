export type PlayerPieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export const DEFAULT_PLAYER_PIECE_TYPE: PlayerPieceType = 'p';

/** Grid order for the piece picker. */
export const PLAYER_PIECE_OPTIONS: PlayerPieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

export function isPlayerPieceType(value: unknown): value is PlayerPieceType {
  return typeof value === 'string' && (PLAYER_PIECE_OPTIONS as string[]).includes(value);
}

export function normalizePlayerPieceType(value: unknown): PlayerPieceType {
  return isPlayerPieceType(value) ? value : DEFAULT_PLAYER_PIECE_TYPE;
}
