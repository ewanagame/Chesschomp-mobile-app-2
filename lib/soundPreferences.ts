import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const PREFS_PATH = `${documentDirectory}sound-preferences.json`;

type SoundPreferences = {
  enabled: boolean;
};

const DEFAULT_PREFS: SoundPreferences = { enabled: true };

export async function loadSoundEnabled(): Promise<boolean> {
  try {
    const info = await getInfoAsync(PREFS_PATH);
    if (!info.exists) {
      return DEFAULT_PREFS.enabled;
    }

    const raw = await readAsStringAsync(PREFS_PATH);
    const parsed = JSON.parse(raw) as Partial<SoundPreferences>;
    return parsed.enabled ?? DEFAULT_PREFS.enabled;
  } catch {
    return DEFAULT_PREFS.enabled;
  }
}

export async function saveSoundEnabled(enabled: boolean): Promise<void> {
  const payload: SoundPreferences = { enabled };
  await writeAsStringAsync(PREFS_PATH, JSON.stringify(payload));
}
