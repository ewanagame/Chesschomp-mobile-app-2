import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import {
  parseActiveGameSnapshot,
  type ActiveGameSnapshot,
} from './activeGameSnapshot';

/** Logical storage key; persisted as `${documentDirectory}activeGame.json`. */
export const ACTIVE_GAME_STORAGE_KEY = 'activeGame';

const ACTIVE_GAME_PATH = `${documentDirectory}${ACTIVE_GAME_STORAGE_KEY}.json`;

export type { ActiveGameSnapshot } from './activeGameSnapshot';
export { isFinishedActiveGame } from './activeGameSnapshot';

export async function loadActiveGame(): Promise<ActiveGameSnapshot | null> {
  try {
    const info = await getInfoAsync(ACTIVE_GAME_PATH);
    if (!info.exists) {
      return null;
    }

    const raw = JSON.parse(await readAsStringAsync(ACTIVE_GAME_PATH)) as unknown;
    return parseActiveGameSnapshot(raw);
  } catch {
    return null;
  }
}

export async function saveActiveGame(snapshot: ActiveGameSnapshot): Promise<void> {
  await writeAsStringAsync(ACTIVE_GAME_PATH, JSON.stringify(snapshot));
}

export async function clearActiveGame(): Promise<void> {
  try {
    const info = await getInfoAsync(ACTIVE_GAME_PATH);
    if (!info.exists) {
      return;
    }

    await writeAsStringAsync(ACTIVE_GAME_PATH, '');
  } catch {
    // Ignore cleanup failures.
  }
}

export async function hasActiveGame(): Promise<boolean> {
  const snapshot = await loadActiveGame();
  return snapshot != null;
}
