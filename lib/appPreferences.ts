import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import { clampClassificationMovetimeMs, RECOMMENDED_CLASSIFICATION_MOVETIME_MS } from './classificationMovetime';
import {
  clampHistoryNavSpeed,
  DEFAULT_HISTORY_DOUBLE_HOLD_SPEED,
  DEFAULT_HISTORY_HOLD_SPEED,
} from './holdRepeat';
import {
  clampReviewDepth,
  clampReviewPlaybackSpeed,
  DEFAULT_REVIEW_PLAYBACK_SPEED,
  RECOMMENDED_REVIEW_DEPTH,
} from './reviewSettings';
import { normalizePlayerName } from './playerName';
import { DEFAULT_PLAYER_PIECE_TYPE, normalizePlayerPieceType, type PlayerPieceType } from './playerPiece';
import type { ColorScheme } from '../theme';

const PREFS_PATH = `${documentDirectory}app-preferences.json`;

export type AppPreferences = {
  checkmateAnimationEnabled: boolean;
  chompSoundEnabled: boolean;
  classificationMovetimeMs: number;
  moveQualitySpinAnimationEnabled: boolean;
  playerName: string;
  playerPieceType: PlayerPieceType;
  reviewDepth: number;
  reviewPlaybackSpeed: number;
  historyHoldSpeed: number;
  historyDoubleHoldSpeed: number;
  reviewShowBestMoveArrows: boolean;
  colorScheme: ColorScheme;
};

export type AppPreferenceKey = keyof AppPreferences;

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  checkmateAnimationEnabled: true,
  chompSoundEnabled: true,
  classificationMovetimeMs: RECOMMENDED_CLASSIFICATION_MOVETIME_MS,
  moveQualitySpinAnimationEnabled: true,
  playerName: 'You',
  playerPieceType: DEFAULT_PLAYER_PIECE_TYPE,
  reviewDepth: RECOMMENDED_REVIEW_DEPTH,
  reviewPlaybackSpeed: DEFAULT_REVIEW_PLAYBACK_SPEED,
  historyHoldSpeed: DEFAULT_HISTORY_HOLD_SPEED,
  historyDoubleHoldSpeed: DEFAULT_HISTORY_DOUBLE_HOLD_SPEED,
  reviewShowBestMoveArrows: true,
  colorScheme: 'dark',
};

export function mergeWithDefaults(partial: Partial<AppPreferences> | null | undefined): AppPreferences {
  const merged = {
    ...DEFAULT_APP_PREFERENCES,
    ...partial,
  };
  return {
    ...merged,
    classificationMovetimeMs: clampClassificationMovetimeMs(merged.classificationMovetimeMs),
    playerName: normalizePlayerName(typeof merged.playerName === 'string' ? merged.playerName : ''),
    playerPieceType: normalizePlayerPieceType(merged.playerPieceType),
    reviewDepth: clampReviewDepth(merged.reviewDepth),
    reviewPlaybackSpeed: clampReviewPlaybackSpeed(merged.reviewPlaybackSpeed),
    historyHoldSpeed: clampHistoryNavSpeed(merged.historyHoldSpeed, DEFAULT_HISTORY_HOLD_SPEED),
    historyDoubleHoldSpeed: clampHistoryNavSpeed(
      merged.historyDoubleHoldSpeed,
      DEFAULT_HISTORY_DOUBLE_HOLD_SPEED,
    ),
    reviewShowBestMoveArrows: merged.reviewShowBestMoveArrows !== false,
    colorScheme: merged.colorScheme === 'light' ? 'light' : 'dark',
  };
}

export async function loadAppPreferences(): Promise<AppPreferences> {
  try {
    const info = await getInfoAsync(PREFS_PATH);
    if (!info.exists) {
      return { ...DEFAULT_APP_PREFERENCES };
    }

    const raw = await readAsStringAsync(PREFS_PATH);
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return mergeWithDefaults(parsed);
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export async function saveAppPreferences(preferences: AppPreferences): Promise<void> {
  await writeAsStringAsync(PREFS_PATH, JSON.stringify(preferences));
}

export async function saveAppPreference<K extends AppPreferenceKey>(
  key: K,
  value: AppPreferences[K],
): Promise<AppPreferences> {
  const current = await loadAppPreferences();
  const next = { ...current, [key]: value };
  await saveAppPreferences(next);
  return next;
}
