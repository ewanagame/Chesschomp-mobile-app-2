import AppNavigator from './navigation/AppNavigator';
import { AppPreferencesProvider } from './contexts/AppPreferencesContext';
import { ChessSoundProvider, preloadChessSounds } from './contexts/ChessSoundContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { loadActiveGame } from './lib/activeGame';
import { buildResumeNavigationState } from './lib/initialNavigation';
import { loadSoundEnabled } from './lib/soundPreferences';
import { preloadDeferredImages, preloadStartupImages } from './lib/preloadImages';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import type { PartialState, NavigationState } from '@react-navigation/native';

SplashScreen.preventAutoHideAsync();

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.statusBarStyle} />;
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialSoundEnabled, setInitialSoundEnabled] = useState(true);
  const [initialNavigationState, setInitialNavigationState] = useState<
    PartialState<NavigationState> | undefined
  >(undefined);

  useEffect(() => {
    async function prepare() {
      try {
        const [soundEnabled, activeGame] = await Promise.all([
          loadSoundEnabled(),
          loadActiveGame(),
          preloadChessSounds(),
          preloadStartupImages(),
        ]);
        setInitialSoundEnabled(soundEnabled);
        setInitialNavigationState(buildResumeNavigationState(activeGame));
        void preloadDeferredImages();
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
          <AppNavigator initialNavigationState={initialNavigationState} />
          <ThemedStatusBar />
        </ChessSoundProvider>
      </ThemeProvider>
    </AppPreferencesProvider>
  );
}
