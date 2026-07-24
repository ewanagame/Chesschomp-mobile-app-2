import ChessBoard from './components/ChessBoard';
import { StockfishEngineProvider } from './components/StockfishWebViewEngine';
import WarmRadialBackground from './components/WarmRadialBackground';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Add any async resource loading here when needed.
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
    <StockfishEngineProvider>
      <View style={styles.container}>
        <WarmRadialBackground />
        <ChessBoard />
        <StatusBar style="light" />
      </View>
    </StockfishEngineProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
