import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import type { ReviewAnalysisProgress } from '../hooks/useGameReviewAnalysis';
import type { AppTheme } from '../theme';

type ReviewAnalysisProgressCardProps = {
  progress: ReviewAnalysisProgress;
  progressPercent: number;
  onRetry?: () => void;
};

export default function ReviewAnalysisProgressCard({
  progress,
  progressPercent,
  onRetry,
}: ReviewAnalysisProgressCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createReviewAnalysisProgressCardStyles(theme), [theme]);

  if (progress.phase === 'complete') {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{progress.message}</Text>
      <Text style={styles.percent}>{progressPercent.toFixed(1)}%</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, progressPercent)}%` }]} />
      </View>
      <Text style={styles.subtitle}>
        {progress.phase === 'error'
          ? 'Your finished moves are still on the board. Retry to analyze the rest.'
          : 'This might take a few seconds…'}
      </Text>
      {progress.phase === 'error' && onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry analysis"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      ) : null}
      <View style={styles.adSlot} accessibilityLabel="Advertisement placeholder">
        <Text style={styles.adText}>Ad</Text>
      </View>
    </View>
  );
}

function createReviewAnalysisProgressCardStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      padding: 14,
      gap: 8,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    percent: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    track: {
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.surfaceBackground,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: theme.accentBorderStrong,
    },
    subtitle: {
      color: theme.textFaint,
      fontSize: 12,
      fontWeight: '500',
    },
    retryButton: {
      alignSelf: 'flex-start',
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    retryButtonText: {
      color: theme.accentText,
      fontSize: 15,
      fontWeight: '800',
    },
    adSlot: {
      marginTop: 6,
      minHeight: 72,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adText: {
      color: theme.textFaint,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
}
