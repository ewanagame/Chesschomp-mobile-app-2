import AppNavigator from './navigation/AppNavigator';
import { AppPreferencesProvider } from './contexts/AppPreferencesContext';
import { ChessSoundProvider, preloadChessSounds } from './contexts/ChessSoundContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { loadSoundEnabled } from './lib/soundPreferences';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.statusBarStyle} />;
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialSoundEnabled, setInitialSoundEnabled] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        const [soundEnabled] = await Promise.all([loadSoundEnabled(), preloadChessSounds()]);
        setInitialSoundEnabled(soundEnabled);
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <AppPreferencesProvider>
      <ThemeProvider>
        <ChessSoundProvider initialSoundEnabled={initialSoundEnabled}>
          <AppNavigator />
          <ThemedStatusBar />
        </ChessSoundProvider>
      </ThemeProvider>
    </AppPreferencesProvider>
  );
}
