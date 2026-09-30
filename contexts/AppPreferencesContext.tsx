import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_APP_PREFERENCES,
  loadAppPreferences,
  saveAppPreferences,
  type AppPreferenceKey,
  type AppPreferences,
} from '../lib/appPreferences';
import { clampClassificationMovetimeMs } from '../lib/classificationMovetime';
import { normalizePlayerName } from '../lib/playerName';
import { normalizePlayerPieceType } from '../lib/playerPiece';
import { clampHistoryNavSpeed } from '../lib/holdRepeat';
import { clampReviewDepth, clampReviewPlaybackSpeed } from '../lib/reviewSettings';

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  setPreference: <K extends AppPreferenceKey>(key: K, value: AppPreferences[K]) => void;
  checkmateAnimationEnabled: boolean;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

const SLIDER_PREFERENCE_KEYS = new Set<AppPreferenceKey>([
  'classificationMovetimeMs',
  'reviewDepth',
  'reviewPlaybackSpeed',
  'historyHoldSpeed',
  'historyDoubleHoldSpeed',
]);

function isSliderPreference(key: AppPreferenceKey): boolean {
  return SLIDER_PREFERENCE_KEYS.has(key);
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loaded = await loadAppPreferences();
      if (!cancelled) {
        setPreferences(loaded);
        preferencesRef.current = loaded;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePersist = useCallback((next: AppPreferences, key: AppPreferenceKey) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    if (!isSliderPreference(key)) {
      void saveAppPreferences(next);
      return;
    }

    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void saveAppPreferences(preferencesRef.current);
    }, 180);
  }, []);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        void saveAppPreferences(preferencesRef.current);
      }
    };
  }, []);

  const setPreference = useCallback(<K extends AppPreferenceKey>(key: K, value: AppPreferences[K]) => {
    let normalizedValue = value;
    if (key === 'classificationMovetimeMs') {
      normalizedValue = clampClassificationMovetimeMs(value as number) as AppPreferences[K];
    } else if (key === 'reviewDepth') {
      normalizedValue = clampReviewDepth(value as number) as AppPreferences[K];
    } else if (key === 'reviewPlaybackSpeed') {
      normalizedValue = clampReviewPlaybackSpeed(value as number) as AppPreferences[K];
    } else if (key === 'historyHoldSpeed' || key === 'historyDoubleHoldSpeed') {
      normalizedValue = clampHistoryNavSpeed(value as number) as AppPreferences[K];
    } else if (key === 'playerName') {
      normalizedValue = normalizePlayerName(String(value)) as AppPreferences[K];
    } else if (key === 'playerPieceType') {
      normalizedValue = normalizePlayerPieceType(value) as AppPreferences[K];
    }

    const next = { ...preferencesRef.current, [key]: normalizedValue };
    preferencesRef.current = next;
    setPreferences(next);
    schedulePersist(next, key);
  }, [schedulePersist]);

  const value = useMemo(
    () => ({
      preferences,
      setPreference,
      checkmateAnimationEnabled: preferences.checkmateAnimationEnabled,
    }),
    [preferences, setPreference],
  );

  return (
    <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }
  return context;
}

export function useCheckmateAnimationEnabledRef() {
  const { preferences } = useAppPreferences();
  const ref = useRef(preferences.checkmateAnimationEnabled);

  useEffect(() => {
    ref.current = preferences.checkmateAnimationEnabled;
  }, [preferences.checkmateAnimationEnabled]);

  return ref;
}

export function useClassificationMovetimeMsRef() {
  const { preferences } = useAppPreferences();
  const ref = useRef(preferences.classificationMovetimeMs);

  useEffect(() => {
    ref.current = preferences.classificationMovetimeMs;
  }, [preferences.classificationMovetimeMs]);

  return ref;
}

export function useMoveQualitySpinAnimationEnabledRef() {
  const { preferences } = useAppPreferences();
  const ref = useRef(preferences.moveQualitySpinAnimationEnabled);

  useEffect(() => {
    ref.current = preferences.moveQualitySpinAnimationEnabled;
  }, [preferences.moveQualitySpinAnimationEnabled]);

  return ref;
}

export function useChompSoundEnabledRef() {
  const { preferences } = useAppPreferences();
  const ref = useRef(preferences.chompSoundEnabled);

  useEffect(() => {
    ref.current = preferences.chompSoundEnabled;
  }, [preferences.chompSoundEnabled]);

  return ref;
}

export function useReviewDepthRef() {
  const { preferences } = useAppPreferences();
  const ref = useRef(preferences.reviewDepth);

  useEffect(() => {
    ref.current = preferences.reviewDepth;
  }, [preferences.reviewDepth]);

  return ref;
}

export function useReviewShowBestMoveArrowsRef() {
  const { preferences } = useAppPreferences();
  const ref = useRef(preferences.reviewShowBestMoveArrows);

  useEffect(() => {
    ref.current = preferences.reviewShowBestMoveArrows;
  }, [preferences.reviewShowBestMoveArrows]);

  return ref;
}
