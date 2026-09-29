import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';

import ChessBoard, { type ChessBoardHandle } from '../components/ChessBoard';
import NameGameModal from '../components/NameGameModal';
import PostGameOverlay, {
  POST_GAME_OVERLAY_SCROLL_INSET,
  type PostGameOverlayStep,
} from '../components/PostGameOverlay';
import ScreenBackButton from '../components/ScreenBackButton';
import ScreenHomeButton from '../components/ScreenHomeButton';
import { StockfishEngineProvider } from '../components/StockfishWebViewEngine';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { useTheme } from '../contexts/ThemeContext';
import {
  clearActiveGame,
  loadActiveGame,
  saveActiveGame,
  type ActiveGameSnapshot,
} from '../lib/activeGame';
import { buildSavedGameFromSnapshot, suggestedSavedGameName } from '../lib/buildSavedGame';
import { getBotById } from '../lib/bots';
import { toPgn } from '../lib/gameHistory';
import { saveGame } from '../lib/savedGames';
import type { RootStackParamList } from '../navigation/types';
import type { AppTheme } from '../theme';

type BoardScreenProps = NativeStackScreenProps<RootStackParamList, 'Board'>;

export default function BoardScreen({ navigation, route }: BoardScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createBoardScreenStyles(theme), [theme]);
  const isFocused = useIsFocused();
  const boardRef = useRef<ChessBoardHandle>(null);
  const [postGameResult, setPostGameResult] = useState<string | null>(null);
  const [postGameExplanation, setPostGameExplanation] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayStep, setOverlayStep] = useState<PostGameOverlayStep>('result');
  const [gameFinished, setGameFinished] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [defaultSaveName, setDefaultSaveName] = useState('');
  const shouldResume = route.params.resume === true;
  const [restoredSnapshot, setRestoredSnapshot] = useState<
    ActiveGameSnapshot | null | undefined
  >(shouldResume ? undefined : null);
  const [preservedSnapshot, setPreservedSnapshot] = useState<ActiveGameSnapshot | null>(null);

  useEffect(() => {
    if (!shouldResume) {
      setRestoredSnapshot(null);
      return;
    }

    let cancelled = false;
    void loadActiveGame().then((snapshot) => {
      if (!cancelled) {
        setRestoredSnapshot(snapshot);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldResume]);

  const bot = useMemo(() => {
    if (restoredSnapshot?.mode === 'bot' && restoredSnapshot.botId) {
      return getBotById(restoredSnapshot.botId);
    }

    return route.params.mode === 'bot' ? getBotById(route.params.botId) : undefined;
  }, [restoredSnapshot, route.params]);

  const gameMode = restoredSnapshot?.mode ?? route.params.mode;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: gameFinished });
  }, [gameFinished, navigation]);

  const handleLeaveBoard = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (route.params.mode === 'bot') {
      navigation.navigate('Bots');
      return;
    }

    navigation.navigate('Home');
  }, [navigation, route.params.mode]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (overlayVisible && overlayStep === 'save') {
          setOverlayStep('result');
          return true;
        }
        if (overlayVisible) {
          setOverlayVisible(false);
          return true;
        }
        handleLeaveBoard();
        return true;
      });
      return () => subscription.remove();
    }, [handleLeaveBoard, overlayStep, overlayVisible]),
  );

  const handleActiveGameSnapshotChange = useCallback((snapshot: ActiveGameSnapshot | null) => {
    if (snapshot) {
      setPreservedSnapshot(snapshot);
      void saveActiveGame(snapshot);
      return;
    }

    void clearActiveGame();
  }, []);

  const persistActiveGameNow = useCallback(() => {
    const snapshot = boardRef.current?.getActiveGameSnapshot();
    if (snapshot) {
      void saveActiveGame(snapshot);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        persistActiveGameNow();
      }
    });

    return () => subscription.remove();
  }, [persistActiveGameNow]);

  const handleGameEnded = useCallback((outcome: { result: string; explanation: string | null }) => {
    const snapshot = boardRef.current?.getFinishedGameSnapshot();
    if (snapshot) {
      const finishedSnapshot = { ...snapshot, finished: true };
      setPreservedSnapshot(finishedSnapshot);
      void saveActiveGame(finishedSnapshot);
    }
    setPostGameResult(outcome.result);
    setPostGameExplanation(outcome.explanation);
    setOverlayVisible(true);
    setOverlayStep('result');
    setGameFinished(true);
  }, []);

  const handleDismissOverlay = useCallback(() => {
    if (overlayStep === 'save') {
      setOverlayStep('result');
      return;
    }
    setOverlayVisible(false);
  }, [overlayStep]);

  const handleRematch = useCallback(() => {
    setPreservedSnapshot(null);
    void clearActiveGame();
    setPostGameResult(null);
    setPostGameExplanation(null);
    setOverlayVisible(false);
    setOverlayStep('result');
    setGameFinished(false);
    boardRef.current?.rematch();
  }, []);

  const handleHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  const handleSavePgn = useCallback(() => {
    boardRef.current?.savePgn();
  }, []);

  const handleSaveFen = useCallback(() => {
    boardRef.current?.saveFen();
  }, []);

  const handleOpenSettings = useCallback(() => {
    const snapshot =
      boardRef.current?.getFinishedGameSnapshot() ?? boardRef.current?.getActiveGameSnapshot();
    if (snapshot) {
      const toSave = gameFinished ? { ...snapshot, finished: true } : snapshot;
      setPreservedSnapshot(toSave);
      void saveActiveGame(toSave);
    }
    navigation.navigate('Settings', { scrollTo: 'savingGames' });
  }, [gameFinished, navigation]);

  const openSaveToMyGamesModal = useCallback(() => {
    const snapshot = boardRef.current?.getFinishedGameSnapshot();
    if (!snapshot || snapshot.session.moves.length === 0) {
      return;
    }
    setDefaultSaveName(suggestedSavedGameName(snapshot));
    setSaveModalVisible(true);
  }, []);

  const handleConfirmSaveToMyGames = useCallback(
    (name: string) => {
      const snapshot = boardRef.current?.getFinishedGameSnapshot();
      if (!snapshot) {
        setSaveModalVisible(false);
        return;
      }
      const saved = buildSavedGameFromSnapshot(snapshot, name, postGameResult ?? undefined);
      void saveGame(saved).then(() => {
        setSaveModalVisible(false);
        setOverlayStep('result');
      });
    },
    [postGameResult],
  );

  const handleReviewGame = useCallback(() => {
    const snapshot = boardRef.current?.getFinishedGameSnapshot();
    if (!snapshot || snapshot.session.moves.length === 0) {
      return;
    }
    const pgn = toPgn(snapshot.session);
    setOverlayVisible(false);
    navigation.navigate('GameReview', { source: 'pgn', pgn });
  }, [navigation]);

  const handleOpenFreeBoardModes = useCallback(() => {
    navigation.navigate('FreeBoardModes');
  }, [navigation]);

  const initialPassAndPlay =
    route.params.mode === 'free' ? route.params.passAndPlay === true : false;

  if (!isFocused) {
    return null;
  }

  if (shouldResume && restoredSnapshot === undefined) {
    return null;
  }

  return (
    <StockfishEngineProvider>
      <View style={styles.container}>
        <WarmRadialBackground />
        <ScreenBackButton onPress={handleLeaveBoard} accessibilityLabel="Go back" />
        {overlayVisible && postGameResult != null ? <ScreenHomeButton /> : null}
        <ChessBoard
          ref={boardRef}
          bot={bot}
          gameMode={gameMode}
          initialActiveGameSnapshot={
            preservedSnapshot ?? (shouldResume ? restoredSnapshot ?? null : null)
          }
          initialGameFinished={
            gameMode === 'bot' &&
            (gameFinished ||
              Boolean(preservedSnapshot?.finished) ||
              Boolean(restoredSnapshot?.finished))
          }
          initialPassAndPlay={initialPassAndPlay}
          onActiveGameSnapshotChange={handleActiveGameSnapshotChange}
          onOpenFreeBoardModes={gameMode === 'free' ? handleOpenFreeBoardModes : undefined}
          onGameEnded={handleGameEnded}
          onAbortGame={handleHome}
          onSaveToMyGames={openSaveToMyGamesModal}
          historyScrollPaddingBottom={
            overlayVisible && postGameResult != null ? POST_GAME_OVERLAY_SCROLL_INSET : 0
          }
        />
        <PostGameOverlay
          visible={overlayVisible && postGameResult != null}
          step={overlayStep}
          result={postGameResult ?? ''}
          resultExplanation={postGameExplanation}
          onDismiss={handleDismissOverlay}
          onRematch={handleRematch}
          onHome={handleHome}
          onReview={handleReviewGame}
          onSaveGame={() => setOverlayStep('save')}
          onBackToResult={() => setOverlayStep('result')}
          onSavePgn={handleSavePgn}
          onSaveFen={handleSaveFen}
          onSaveToMyGames={openSaveToMyGamesModal}
          onOpenSettings={handleOpenSettings}
        />
        <NameGameModal
          visible={saveModalVisible}
          defaultName={defaultSaveName}
          onCancel={() => setSaveModalVisible(false)}
          onSave={handleConfirmSaveToMyGames}
        />
      </View>
    </StockfishEngineProvider>
  );
}

function createBoardScreenStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
  });
}
