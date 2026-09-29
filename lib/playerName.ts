export const DEFAULT_PLAYER_NAME = 'You';
export const MAX_PLAYER_NAME_WORDS = 15;

export function countPlayerNameWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

/** Trim and collapse whitespace; empty input falls back to the default name. */
export function normalizePlayerName(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return DEFAULT_PLAYER_NAME;
  }
  const words = collapsed.split(' ');
  if (words.length <= MAX_PLAYER_NAME_WORDS) {
    return collapsed;
  }
  return words.slice(0, MAX_PLAYER_NAME_WORDS).join(' ');
}

/** Keep typing within the word cap while preserving in-progress spacing. */
export function limitPlayerNameWords(value: string, maxWords = MAX_PLAYER_NAME_WORDS): string {
  if (!value.trim()) {
    return value.replace(/\s+/g, ' ');
  }

  const leadingSpace = /^\s/.test(value);
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return value;
  }

  const limited = words.slice(0, maxWords).join(' ');
  return leadingSpace ? ` ${limited}` : limited;
}

export function isPlayerNameDraftEmpty(value: string): boolean {
  return value.trim().length === 0;
}
