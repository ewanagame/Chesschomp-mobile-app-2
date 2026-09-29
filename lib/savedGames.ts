import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import { normalizeSavedGameName } from './savedGameName';
import {
  parseSavedGame,
  parseSavedGamesFile,
  removeSavedGameById,
  sanitizeCachedReview,
  type CachedReview,
  type SavedGame,
} from './savedGamesParse';

/** Logical storage key; persisted as `${documentDirectory}savedGames.json`. */
export const SAVED_GAMES_STORAGE_KEY = 'savedGames';

const SAVED_GAMES_PATH = `${documentDirectory}${SAVED_GAMES_STORAGE_KEY}.json`;

export type { CachedReview, SavedGame } from './savedGamesParse';
export {
  createSavedGameId,
  defaultSavedGameName,
  parseSavedGame,
  parseSavedGamesFile,
  removeSavedGameById,
} from './savedGamesParse';

type SavedGamesFile = {
  games: SavedGame[];
};

async function readSavedGamesFile(): Promise<SavedGamesFile> {
  try {
    const info = await getInfoAsync(SAVED_GAMES_PATH);
    if (!info.exists) {
      return { games: [] };
    }

    const raw = JSON.parse(await readAsStringAsync(SAVED_GAMES_PATH)) as unknown;
    return { games: parseSavedGamesFile(raw) };
  } catch {
    return { games: [] };
  }
}

async function writeSavedGamesFile(games: SavedGame[]): Promise<void> {
  const payload: SavedGamesFile = { games };
  await writeAsStringAsync(SAVED_GAMES_PATH, JSON.stringify(payload));
}

export async function listSavedGames(): Promise<SavedGame[]> {
  const file = await readSavedGamesFile();
  return file.games;
}

export async function getSavedGame(id: string): Promise<SavedGame | null> {
  const file = await readSavedGamesFile();
  return file.games.find((game) => game.id === id) ?? null;
}

export async function saveGame(game: SavedGame): Promise<void> {
  const name = normalizeSavedGameName(game.name);
  if (!name) {
    return;
  }

  const review = game.review == null ? undefined : sanitizeCachedReview(game.review) ?? undefined;
  const file = await readSavedGamesFile();
  const nextGames = [
    { ...game, name, ...(review != null ? { review } : { review: undefined }) },
    ...file.games.filter((existing) => existing.id !== game.id),
  ];
  await writeSavedGamesFile(nextGames);
}

export async function renameSavedGame(id: string, name: string): Promise<SavedGame | null> {
  const trimmed = normalizeSavedGameName(name);
  if (!trimmed) {
    return null;
  }

  const file = await readSavedGamesFile();
  let updated: SavedGame | null = null;
  const nextGames = file.games.map((game) => {
    if (game.id !== id) {
      return game;
    }
    updated = { ...game, name: trimmed };
    return updated;
  });

  if (!updated) {
    return null;
  }

  await writeSavedGamesFile(nextGames);
  return updated;
}

export async function deleteSavedGame(id: string): Promise<boolean> {
  const file = await readSavedGamesFile();
  const nextGames = removeSavedGameById(file.games, id);
  if (!nextGames) {
    return false;
  }

  await writeSavedGamesFile(nextGames);
  return true;
}

export async function attachReview(
  id: string,
  review: CachedReview,
): Promise<SavedGame | null> {
  const file = await readSavedGamesFile();
  let updated: SavedGame | null = null;
  const nextGames = file.games.map((game) => {
    if (game.id !== id) {
      return game;
    }
    const sanitized = sanitizeCachedReview(review);
    if (!sanitized) {
      return game;
    }
    updated = { ...game, review: sanitized };
    return updated;
  });

  if (!updated) {
    return null;
  }

  await writeSavedGamesFile(nextGames);
  return updated;
}
