import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import ChessBoard from '../components/ChessBoard';
import ActionLeadingIcon from '../components/ActionLeadingIcon';
import EvalGraph from '../components/EvalGraph';
import MoveHistoryList from '../components/MoveHistoryList';
import NameGameModal from '../components/NameGameModal';
import ReviewAccuracyPanel from '../components/ReviewAccuracyPanel';
import ReviewAnalysisProgressCard from '../components/ReviewAnalysisProgressCard';
import ReviewMoveSummary from '../components/ReviewMoveSummary';
import ReviewSettingsModal from '../components/ReviewSettingsModal';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import ScreenHomeButton from '../components/ScreenHomeButton';
import { StockfishEngineProvider } from '../components/StockfishWebViewEngine';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { IconButton } from '../components/ui';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGameReviewAnalysis } from '../hooks/useGameReviewAnalysis';
import { formatOpeningLabel, getOpeningBook } from '../lib/openingBook';
import { parseFenForReview, parsePgnForReview, reviewDataFromSavedGame, buildSavedGameFromReview, suggestedReviewSaveName } from '../lib/reviewGameImport';
import { REVIEW_ANALYSIS_VERSION } from '../lib/reviewSettings';
import { attachReview, getSavedGame, saveGame } from '../lib/savedGames';
import type { RootStackParamList } from '../navigation/types';
import type { AppTheme } from '../theme';

type GameReviewScreenProps = NativeStackScreenProps<RootStackParamList, 'GameReview'>;

function GameReviewContent({
  navigation,
  route,
}: GameReviewScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createGameReviewStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const { preferences } = useAppPreferences();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [savedGameState, setSavedGameState] = useState<Awaited<ReturnType<typeof getSavedGame>>>(null);
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);
  const [persistedGameId, setPersistedGameId] = useState<string | null>(
    route.params.source === 'saved' ? route.params.gameId : null,
  );
  const [saveModalVisible, setSaveModalVisible] = useState(false);

  const reviewData = useMemo(() => {
    if (route.params.source === 'saved') {
      if (savedGameState) {
        return reviewDataFromSavedGame(savedGameState);
      }
      return null;
    }
    if (route.params.source === 'pgn') {
      const parsed = parsePgnForReview(route.params.pgn);
      return parsed.ok ? parsed.data : null;
    }
    const parsed = parseFenForReview(route.params.fen);
    return parsed.ok ? parsed.data : null;
  }, [route.params, savedGameState]);

  useEffect(() => {
    if (route.params.source !== 'saved') {
      return;
    }
    const key = route.params.gameId;
    if (loadedSourceKey === key) {
      return;
    }
    void getSavedGame(route.params.gameId).then((game) => {
      setSavedGameState(game);
      setLoadedSourceKey(key);
    });
  }, [loadedSourceKey, route.params]);

  const [currentPlyIndex, setCurrentPlyIndex] = useState(-1);
  const reviewMoveCount = reviewData?.moves.length ?? 0;
  const reviewFenCount = reviewData?.fens.length ?? 0;
  const hasReviewData = reviewData != null;

  useEffect(() => {
    if (!hasReviewData) {
      return;
    }
    setCurrentPlyIndex(reviewMoveCount > 0 ? -1 : reviewFenCount > 0 ? 0 : -1);
  }, [hasReviewData, reviewFenCount, reviewMoveCount]);

  const cachedReview =
    (route.params.source === 'saved' && savedGameState?.review) ||
    (persistedGameId != null && savedGameState?.id === persistedGameId
      ? savedGameState.review
      : null) ||
    null;

  const { classifiedMoves, progress, progressPercent, rerunAnalysis, resumeAnalysis } =
    useGameReviewAnalysis({
      moves: reviewData?.moves ?? [],
      fens: reviewData?.fens ?? [],
      savedGameId: persistedGameId ?? undefined,
      cachedReview,
    });

  const boardWidth = Math.max(0, windowWidth - 16);
  const analysisReady = progress.phase === 'complete';
  const currentRecord =
    analysisReady && currentPlyIndex >= 0 ? classifiedMoves[currentPlyIndex] ?? null : null;
  const openingName = useMemo(() => {
    if (!analysisReady || !reviewData || currentPlyIndex < 0) {
      return null;
    }
    const moves = reviewData.moves.slice(0, currentPlyIndex + 1);
    const match = getOpeningBook().lookupOpening(moves);
    return match ? formatOpeningLabel(match.name) : null;
  }, [analysisReady, currentPlyIndex, reviewData]);

  useEffect(() => {
    if (analysisReady || !hasReviewData) {
      return;
    }
    setCurrentPlyIndex(reviewMoveCount > 0 ? -1 : reviewFenCount > 0 ? 0 : -1);
  }, [analysisReady, hasReviewData, reviewFenCount, reviewMoveCount]);

  const persistEvaluation = useCallback(
    async (targetId: string) => {
      const updated = await attachReview(targetId, {
        depth: preferences.reviewDepth,
        classifiedMoves: [...classifiedMoves],
        analyzedAt: Date.now(),
        analysisVersion: REVIEW_ANALYSIS_VERSION,
      });
      if (!updated) {
        Alert.alert('Could not save', 'Try again from My Games.');
        return;
      }
      setSavedGameState(updated);
      setPersistedGameId(updated.id);
      Alert.alert('Saved', 'This evaluation is in My Games.');
    },
    [classifiedMoves, preferences.reviewDepth],
  );

  const handleConfirmNamedSave = useCallback(
    (name: string) => {
      if (!reviewData) {
        setSaveModalVisible(false);
        return;
      }
      const saved = buildSavedGameFromReview(reviewData, name, {
        depth: preferences.reviewDepth,
        classifiedMoves: [...classifiedMoves],
        analyzedAt: Date.now(),
        analysisVersion: REVIEW_ANALYSIS_VERSION,
      });
      setSaveModalVisible(false);
      if (!saved) {
        Alert.alert('Could not save', 'This position has no moves to save.');
        return;
      }
      void saveGame(saved).then(() => {
        setSavedGameState(saved);
        setPersistedGameId(saved.id);
        Alert.alert('Saved', 'This evaluation is in My Games.');
      });
    },
    [classifiedMoves, preferences.reviewDepth, reviewData],
  );

  const promptSaveEvaluation = useCallback(() => {
    if (!analysisReady || classifiedMoves.length === 0) {
      Alert.alert('Not ready', 'Wait until evaluation finishes, then save.');
      return;
    }
    if (!reviewData || reviewData.moves.length === 0) {
      Alert.alert('Cannot save', 'A FEN position has no moves to save to My Games.');
      return;
    }

    Alert.alert(
      'Save evaluation?',
      'This saves the game and its move analysis to My Games. You can reopen it later without waiting for Stockfish.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            if (persistedGameId) {
              void persistEvaluation(persistedGameId);
              return;
            }
            setSaveModalVisible(true);
          },
        },
      ],
    );
  }, [
    analysisReady,
    classifiedMoves.length,
    persistEvaluation,
    persistedGameId,
    reviewData,
  ]);

  if (!reviewData) {
    return (
      <View style={styles.screen}>
        <WarmRadialBackground />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.errorText}>Unable to load this game for post-game evaluation.</Text>
        </SafeAreaView>
        <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <ScreenHomeButton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <View style={styles.backButtonSpacer} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Post-Game Evaluation</Text>
            <View style={styles.headerActions}>
              <IconButton
                size="sm"
                onPress={promptSaveEvaluation}
                disabled={!analysisReady}
                accessibilityLabel="Save evaluation"
              >
                <ActionLeadingIcon
                  name="save"
                  color={analysisReady ? theme.accentText : theme.textFaint}
                  size={18}
                />
              </IconButton>
              <IconButton
                size="sm"
                onPress={() => setSettingsVisible(true)}
                accessibilityLabel="Post-game evaluation settings"
              >
                <Text style={styles.settingsButtonIcon}>⚙</Text>
              </IconButton>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.boardSection}>
            {analysisReady ? (
              <View style={styles.summaryAboveBoard}>
                <ReviewMoveSummary record={currentRecord} openingName={openingName} />
              </View>
            ) : null}
            <ChessBoard
              gameMode="free"
              reviewMode
              reviewEmbedded
              reviewPlaybackLocked={!analysisReady}
              reviewMoves={reviewData.moves}
              reviewFens={reviewData.fens}
              reviewClassifiedMoves={analysisReady ? classifiedMoves : []}
              reviewPlayerColor={reviewData.playerColor}
              reviewShowBestMoveArrows={analysisReady && preferences.reviewShowBestMoveArrows}
              reviewCurrentIndex={currentPlyIndex}
              onReviewPlyChange={setCurrentPlyIndex}
              onSaveReview={promptSaveEvaluation}
            />
          </View>

          <View style={styles.panelContent}>
            <ReviewAnalysisProgressCard
              progress={progress}
              progressPercent={progressPercent}
              onRetry={resumeAnalysis}
            />
            {analysisReady && reviewData.moves.length > 0 ? (
              <EvalGraph
                classifiedMoves={classifiedMoves}
                currentIndex={currentPlyIndex}
                width={boardWidth - 28}
                onSelectPly={setCurrentPlyIndex}
              />
            ) : null}
            {analysisReady && classifiedMoves.length > 0 ? (
              <ReviewAccuracyPanel
                classifiedMoves={classifiedMoves}
                playerColor={reviewData.playerColor}
              />
            ) : null}
            {analysisReady && reviewData.moves.length > 0 ? (
              <MoveHistoryList
                moves={reviewData.moves}
                classifiedMoves={classifiedMoves}
                currentIndex={currentPlyIndex}
                width={boardWidth - 28}
                onSelectPly={setCurrentPlyIndex}
                embedded
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      <ScreenHomeButton />
      <NameGameModal
        visible={saveModalVisible}
        defaultName={suggestedReviewSaveName(reviewData)}
        onCancel={() => setSaveModalVisible(false)}
        onSave={handleConfirmNamedSave}
      />
      <ReviewSettingsModal
        visible={settingsVisible}
        plyCount={reviewData.moves.length}
        onClose={() => setSettingsVisible(false)}
        onDepthChanged={() => {
          void rerunAnalysis();
        }}
      />
    </View>
  );
}

export default function GameReviewScreen(props: GameReviewScreenProps) {
  return (
    <StockfishEngineProvider>
      <GameReviewContent {...props} />
    </StockfishEngineProvider>
  );
}

function createGameReviewStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    headerRow: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
      marginBottom: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      flex: 1,
      paddingRight: 12,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    settingsButtonIcon: {
      color: theme.textSecondary,
      fontSize: 18,
    },
    boardSection: {
      flexGrow: 0,
      flexShrink: 0,
      width: '100%',
    },
    summaryAboveBoard: {
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    panelScroll: {
      flex: 1,
    },
    pageContent: {
      paddingBottom: 24,
    },
    panelContent: {
      paddingHorizontal: 14,
      gap: 14,
    },
    errorText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 120,
      paddingHorizontal: 24,
    },
  });
}
