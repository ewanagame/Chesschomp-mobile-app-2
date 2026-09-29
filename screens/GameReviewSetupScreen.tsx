import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import ScreenHomeButton from '../components/ScreenHomeButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { useTheme } from '../contexts/ThemeContext';
import { listSavedGames, type SavedGame } from '../lib/savedGames';
import type { RootStackParamList } from '../navigation/types';
import type { AppTheme } from '../theme';
import { useFocusEffect } from '@react-navigation/native';

type GameReviewSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'GameReviewSetup'>;

type SetupTab = 'saved' | 'pgn' | 'fen';

export default function GameReviewSetupScreen({ navigation }: GameReviewSetupScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createGameReviewSetupStyles(theme), [theme]);
  const [tab, setTab] = useState<SetupTab>('saved');
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [pgnInput, setPgnInput] = useState('');
  const [fenInput, setFenInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void listSavedGames().then(setSavedGames);
    }, []),
  );

  const handleReviewSaved = useCallback(
    (gameId: string) => {
      navigation.navigate('GameReview', { source: 'saved', gameId });
    },
    [navigation],
  );

  const handleReviewPgn = useCallback(() => {
    const trimmed = pgnInput.trim();
    if (!trimmed) {
      setError('Paste a PGN to evaluate.');
      return;
    }
    setError(null);
    navigation.navigate('GameReview', { source: 'pgn', pgn: trimmed });
  }, [navigation, pgnInput]);

  const handleReviewFen = useCallback(() => {
    const trimmed = fenInput.trim();
    if (!trimmed) {
      setError('Paste a FEN to evaluate.');
      return;
    }
    setError(null);
    navigation.navigate('GameReview', { source: 'fen', fen: trimmed });
  }, [fenInput, navigation]);

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
          <Text style={styles.title}>Post-Game Evaluation</Text>
          <Text style={styles.subtitle}>Evaluate a saved game, PGN, or FEN.</Text>
        </View>

        <View style={styles.tabs}>
          {(['saved', 'pgn', 'fen'] as const).map((value) => (
            <Pressable
              key={value}
              style={({ pressed }) => [
                styles.tab,
                tab === value && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
              onPress={() => {
                setTab(value);
                setError(null);
              }}
            >
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
                {value === 'saved' ? 'Saved' : value.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'saved' ? (
            savedGames.length === 0 ? (
              <Text style={styles.emptyText}>
                No saved games yet. Finish a game and tap Save to My Games.
              </Text>
            ) : (
              savedGames.map((game) => (
                <Pressable
                  key={game.id}
                  style={({ pressed }) => [styles.gameRow, pressed && styles.gameRowPressed]}
                  onPress={() => handleReviewSaved(game.id)}
                >
                  <Text style={styles.gameName} numberOfLines={2}>
                    {game.name}
                  </Text>
                  <Text style={styles.gameMeta}>
                    {game.moves.length} moves · {game.result}
                  </Text>
                </Pressable>
              ))
            )
          ) : null}

          {tab === 'pgn' ? (
            <View style={styles.inputBlock}>
              <TextInput
                value={pgnInput}
                onChangeText={setPgnInput}
                placeholder="Paste PGN here"
                placeholderTextColor={theme.textFaint}
                style={styles.textArea}
                multiline
                textAlignVertical="top"
              />
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                onPress={handleReviewPgn}
              >
                <Text style={styles.primaryButtonText}>Evaluate PGN</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'fen' ? (
            <View style={styles.inputBlock}>
              <TextInput
                value={fenInput}
                onChangeText={setFenInput}
                placeholder="Paste FEN here"
                placeholderTextColor={theme.textFaint}
                style={styles.textInput}
                autoCapitalize="none"
              />
              <Text style={styles.hintText}>
                FEN evaluation analyzes a single position. Accuracy and move lists are not available.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                onPress={handleReviewFen}
              >
                <Text style={styles.primaryButtonText}>Evaluate FEN</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      <ScreenHomeButton />
    </View>
  );
}

function createGameReviewSetupStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 6,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
      marginBottom: 4,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 20,
    },
    tabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabActive: {
      borderColor: theme.accentBorderStrong,
      backgroundColor: theme.accentSurface,
    },
    tabPressed: {
      opacity: 0.9,
    },
    tabText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    tabTextActive: {
      color: theme.accentText,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      gap: 10,
    },
    gameRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 4,
    },
    gameRowPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    gameName: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      flexShrink: 1,
    },
    gameMeta: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 22,
      paddingVertical: 12,
    },
    inputBlock: {
      gap: 12,
    },
    textArea: {
      minHeight: 180,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
    textInput: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.textPrimary,
      fontSize: 14,
    },
    hintText: {
      color: theme.textFaint,
      fontSize: 13,
      lineHeight: 18,
    },
    primaryButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    primaryButtonText: {
      color: theme.accentText,
      fontSize: 16,
      fontWeight: '800',
    },
    errorText: {
      color: theme.accuracyGreen,
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
