export const MAX_SAVED_GAME_NAME_LENGTH = 67;

export function normalizeSavedGameName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_SAVED_GAME_NAME_LENGTH);
}
