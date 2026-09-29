import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActionLeadingIcon from './ActionLeadingIcon';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../theme';

export type PostGameOverlayStep = 'result' | 'save';

/** Reserve space so move history can scroll above the bottom result bar. */
export const POST_GAME_OVERLAY_SCROLL_INSET = 148;

type PostGameOverlayProps = {
  visible: boolean;
  step: PostGameOverlayStep;
  result: string;
  resultExplanation?: string | null;
  onDismiss: () => void;
  onRematch: () => void;
  onHome: () => void;
  onReview: () => void;
  onSaveGame: () => void;
  onBackToResult: () => void;
  onSavePgn: () => void;
  onSaveFen: () => void;
  onSaveToMyGames: () => void;
  onOpenSettings: () => void;
};

export default function PostGameOverlay({
  visible,
  step,
  result,
  resultExplanation,
  onDismiss,
  onRematch,
  onHome,
  onReview,
  onSaveGame,
  onBackToResult,
  onSavePgn,
  onSaveFen,
  onSaveToMyGames,
  onOpenSettings,
}: PostGameOverlayProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createPostGameOverlayStyles(theme), [theme]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <View style={styles.actionBar} pointerEvents="auto">
        {step === 'result' ? (
          <>
            <View style={styles.resultBlock}>
              <Text style={styles.result}>{result}</Text>
              {resultExplanation ? (
                <Text style={styles.resultExplanation}>{resultExplanation}</Text>
              ) : null}
            </View>
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                onPress={onRematch}
                accessibilityRole="button"
                accessibilityLabel="Rematch"
              >
                <ActionLeadingIcon name="rematch" color={theme.accentText} size={18} />
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  Rematch
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={onReview}
                accessibilityRole="button"
                accessibilityLabel="Post-game evaluation"
              >
                <Text style={styles.secondaryButtonText} numberOfLines={1}>
                  Evaluate
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={onSaveGame}
                accessibilityRole="button"
                accessibilityLabel="Save game"
              >
                <ActionLeadingIcon name="save" color={theme.textSecondary} size={18} />
                <Text style={styles.secondaryButtonText} numberOfLines={1}>
                  Save
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.secondaryWideButton, pressed && styles.secondaryButtonPressed]}
              onPress={onHome}
              accessibilityRole="button"
              accessibilityLabel="Home"
            >
              <ActionLeadingIcon name="home" color={theme.textSecondary} size={18} />
              <Text style={styles.secondaryButtonText} numberOfLines={1}>
                Home
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.result}>Save game as</Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.formatButton, styles.primaryFormatButton, pressed && styles.primaryButtonPressed]}
                onPress={onSaveToMyGames}
                accessibilityRole="button"
                accessibilityLabel="Save to my games"
              >
                <Text style={styles.primaryButtonText}>My Games</Text>
                <Text style={styles.formatButtonSubtitlePrimary}>(Named save)</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.formatButton, styles.secondaryFormatButton, pressed && styles.secondaryButtonPressed]}
                onPress={onSavePgn}
                accessibilityRole="button"
                accessibilityLabel="Save as PGN, full game"
              >
                <Text style={styles.secondaryButtonText}>PGN</Text>
                <Text style={styles.formatButtonSubtitleSecondary}>(Full game)</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.formatButton, styles.secondaryFormatButton, pressed && styles.secondaryButtonPressed]}
                onPress={onSaveFen}
                accessibilityRole="button"
                accessibilityLabel="Save as FEN, current position"
              >
                <Text style={styles.secondaryButtonText}>FEN</Text>
                <Text style={styles.formatButtonSubtitleSecondary}>(Current position)</Text>
              </Pressable>
            </View>
            <View style={styles.footerColumn}>
              <Pressable
                style={({ pressed }) => [styles.helpButton, pressed && styles.secondaryButtonPressed]}
                onPress={onOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="What are PGNs and FENs? Click here to learn more"
              >
                <Text style={styles.helpButtonText}>
                  What are PGNs and FENs? (Click here to learn more)
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.backButton, pressed && styles.secondaryButtonPressed]}
                onPress={onBackToResult}
                accessibilityRole="button"
                accessibilityLabel="Back to game result"
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function createPostGameOverlayStyles(theme: AppTheme) {
  return StyleSheet.create({
    host: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
      elevation: 40,
      paddingHorizontal: 12,
    },
    actionBar: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.modalBorder,
      backgroundColor: theme.modalCard,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
      gap: 12,
    },
    resultBlock: {
      gap: 6,
    },
    result: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
    },
    resultExplanation: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 18,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    footerColumn: {
      alignItems: 'stretch',
      gap: 6,
    },
    primaryButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      paddingHorizontal: 4,
      paddingVertical: 8,
      borderRadius: 12,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    primaryButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    primaryButtonText: {
      color: theme.accentText,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    secondaryWideButton: {
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.surfaceBackground,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
    },
    secondaryButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      paddingHorizontal: 4,
      paddingVertical: 8,
      borderRadius: 12,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.surfaceBackground,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    secondaryButtonText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    formatButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    formatButtonSubtitlePrimary: {
      color: theme.accentSoftText,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
    },
    formatButtonSubtitleSecondary: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
    },
    primaryFormatButton: {
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    secondaryFormatButton: {
      backgroundColor: theme.surfaceBackground,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
    },
    backButton: {
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    backButtonText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    helpButton: {
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceBackground,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
    },
    helpButtonText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 16,
    },
  });
}
