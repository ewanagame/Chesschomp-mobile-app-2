import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_POSITION } from 'chess.js';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import GameActionSheet from '../components/GameActionSheet';
import NameGameModal from '../components/NameGameModal';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import ScreenHomeButton from '../components/ScreenHomeButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { Card } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import {
  deleteSavedGame,
  listSavedGames,
  renameSavedGame,
  type SavedGame,
} from '../lib/savedGames';
import type { RootStackParamList } from '../navigation/types';
import { radii, spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type SavedGamesScreenProps = NativeStackScreenProps<RootStackParamList, 'SavedGames'>;

function exportPgnFromSavedGame(game: SavedGame): string {
  return game.pgn.trim() ? game.pgn : '*';
}

function exportFenFromSavedGame(game: SavedGame): string {
  return game.fens[game.fens.length - 1] ?? DEFAULT_POSITION;
}

export default function SavedGamesScreen({ navigation }: SavedGamesScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createSavedGamesStyles(theme), [theme]);
  const [games, setGames] = useState<SavedGame[]>([]);
  const [renameTarget, setRenameTarget] = useState<SavedGame | null>(null);
  const [exportTarget, setExportTarget] = useState<SavedGame | null>(null);

  const refreshGames = useCallback(() => {
    void listSavedGames().then(setGames);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshGames();
    }, [refreshGames]),
  );

  const handleDelete = useCallback(
    (game: SavedGame) => {
      Alert.alert('Delete game?', `Remove "${game.name}" from My Games?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteSavedGame(game.id).then((removed) => {
              if (removed) {
                refreshGames();
              }
            });
          },
        },
      ]);
    },
    [refreshGames],
  );

  const handleReview = useCallback(
    (game: SavedGame) => {
      navigation.navigate('GameReview', { source: 'saved', gameId: game.id });
    },
    [navigation],
  );

  const copyGameFormat = useCallback(async (game: SavedGame, format: 'pgn' | 'fen') => {
    const contents = format === 'pgn' ? exportPgnFromSavedGame(game) : exportFenFromSavedGame(game);
    const formatLabel = format === 'pgn' ? 'PGN' : 'FEN';
    try {
      await Clipboard.setStringAsync(contents);
      Alert.alert('Copied', `${formatLabel} copied to clipboard.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Copy failed', message);
    }
  }, []);

  const handleExport = useCallback(
    (format: 'pgn' | 'fen') => {
      const game = exportTarget;
      setExportTarget(null);
      if (!game) {
        return;
      }
      void copyGameFormat(game, format);
    },
    [copyGameFormat, exportTarget],
  );

  const handleRenameSave = useCallback(
    (name: string) => {
      if (!renameTarget) {
        return;
      }
      void renameSavedGame(renameTarget.id, name).then((updated) => {
        setRenameTarget(null);
        if (updated) {
          refreshGames();
        }
      });
    },
    [renameTarget, refreshGames],
  );

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
          <Text style={styles.title}>My Games</Text>
          <Text style={styles.subtitle}>Saved games you can evaluate anytime.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {games.length === 0 ? (
            <Text style={styles.emptyText}>
              No saved games yet. After a game, tap Save and choose My Games.
            </Text>
          ) : (
            games.map((game) => (
              <Card key={game.id} variant="surface" padding="none" style={styles.gameCard}>
                <Pressable
                  style={({ pressed }) => [styles.gameMain, pressed && styles.gameMainPressed]}
                  onPress={() => navigation.navigate('GameReview', { source: 'saved', gameId: game.id })}
                >
                  <Text style={styles.gameName} numberOfLines={2}>
                    {game.name}
                  </Text>
                  <Text style={styles.gameMeta} numberOfLines={1}>
                    {game.moves.length} moves · {game.result}
                  </Text>
                </Pressable>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                    onPress={() => setRenameTarget(game)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${game.name}`}
                  >
                    <Text style={styles.actionButtonText}>Rename</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                    onPress={() => handleReview(game)}
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${game.name}`}
                  >
                    <Text style={[styles.actionButtonText, styles.reviewText]}>Review</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                    onPress={() => setExportTarget(game)}
                    accessibilityRole="button"
                    accessibilityLabel={`Save ${game.name} as PGN or FEN`}
                  >
                    <Text style={styles.actionButtonText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                    onPress={() => handleDelete(game)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${game.name}`}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      <ScreenHomeButton />
      <NameGameModal
        visible={renameTarget != null}
        defaultName={renameTarget?.name ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSave={handleRenameSave}
      />
      <GameActionSheet
        visible={exportTarget != null}
        options={[]}
        onCancel={() => setExportTarget(null)}
        extraContent={
          <View style={styles.exportSheet}>
            <Text style={styles.exportTitle}>Save game as</Text>
            <Pressable
              style={({ pressed }) => [styles.exportPgnButton, pressed && styles.exportPgnButtonPressed]}
              onPress={() => handleExport('pgn')}
              accessibilityRole="button"
              accessibilityLabel="Save as PGN, full game"
            >
              <Text style={styles.exportPgnTitle}>PGN</Text>
              <Text style={styles.exportPgnSubtitle}>Full game · recommended</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.exportFenButton, pressed && styles.exportFenButtonPressed]}
              onPress={() => handleExport('fen')}
              accessibilityRole="button"
              accessibilityLabel="Save as FEN, final position"
            >
              <Text style={styles.exportFenTitle}>FEN</Text>
              <Text style={styles.exportFenSubtitle}>Final position only</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function createSavedGamesStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
      marginBottom: spacing.xs,
    },
    title: {
      color: theme.textPrimary,
      ...typography.title,
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 20,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 22,
      paddingVertical: spacing.md,
    },
    gameCard: {
      overflow: 'hidden',
    },
    gameMain: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      gap: spacing.xs,
    },
    gameMainPressed: {
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
    actionsRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.surfaceBorder,
    },
    actionButton: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonPressed: {
      backgroundColor: theme.surfaceBackground,
    },
    actionButtonText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    reviewText: {
      color: theme.accentText,
    },
    deleteText: {
      color: theme.destructiveText,
    },
    exportSheet: {
      gap: spacing.md - 2,
    },
    exportTitle: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 2,
    },
    exportPgnButton: {
      minHeight: 88,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    exportPgnButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    exportPgnTitle: {
      color: theme.accentText,
      fontSize: 22,
      fontWeight: '800',
    },
    exportPgnSubtitle: {
      color: theme.accentSoftText,
      fontSize: 13,
      fontWeight: '600',
    },
    exportFenButton: {
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md - 2,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      backgroundColor: theme.surfaceBackground,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
    },
    exportFenButtonPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    exportFenTitle: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
    exportFenSubtitle: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
  });
}
