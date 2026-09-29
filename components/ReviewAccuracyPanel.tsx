import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import MoveClassificationBadge from './MoveClassificationBadge';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import type { AppTheme } from '../theme';
import {
  buildAccuracyReportData,
  classificationDisplayName,
  REPORT_CLASSIFICATION_ORDER,
} from '../utils/accuracyReport';

type ReviewAccuracyPanelProps = {
  classifiedMoves: readonly ClassifiedMoveRecord[];
  playerColor: 'w' | 'b';
};

function formatAccuracy(accuracy: number): string {
  return `${accuracy.toFixed(1)}%`;
}

export default function ReviewAccuracyPanel({
  classifiedMoves,
  playerColor,
}: ReviewAccuracyPanelProps) {
  const theme = useTheme();
  const { preferences } = useAppPreferences();
  const styles = useMemo(() => createReviewAccuracyPanelStyles(theme), [theme]);
  const report = buildAccuracyReportData(classifiedMoves);
  const playerStats = playerColor === 'w' ? report.white : report.black;
  const opponentStats = playerColor === 'w' ? report.black : report.white;
  const playerLabel = preferences.playerName;
  const opponentLabel = 'Opponent';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Accuracy</Text>
      <View style={styles.accuracyTiles}>
        <View style={[styles.accuracyTile, styles.playerTile]}>
          <Text style={styles.playerTileLabel}>{playerLabel}</Text>
          <Text style={styles.playerTileValue}>
            {playerStats.moveCount > 0 ? formatAccuracy(playerStats.accuracy) : 'N/A'}
          </Text>
        </View>
        <View style={[styles.accuracyTile, styles.opponentTile]}>
          <Text style={styles.opponentTileLabel}>{opponentLabel}</Text>
          <Text style={styles.opponentTileValue}>
            {opponentStats.moveCount > 0 ? formatAccuracy(opponentStats.accuracy) : 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.tableLabelCol]}> </Text>
        <Text style={styles.tableHeaderText}>{playerLabel}</Text>
        <Text style={styles.tableHeaderText}> </Text>
        <Text style={styles.tableHeaderText}>{opponentLabel}</Text>
      </View>

      {REPORT_CLASSIFICATION_ORDER.filter((item) => item !== 'MissedWin').map((classification) => (
        <View key={classification} style={styles.tableRow}>
          <Text style={[styles.tableLabel, styles.tableLabelCol]}>
            {classificationDisplayName(classification)}
          </Text>
          <Text style={styles.tableCount}>{playerStats.breakdown[classification]}</Text>
          <View style={styles.badgeCol}>
            <MoveClassificationBadge classification={classification} size={20} />
          </View>
          <Text style={styles.tableCount}>{opponentStats.breakdown[classification]}</Text>
        </View>
      ))}
    </View>
  );
}

function createReviewAccuracyPanelStyles(theme: AppTheme) {
  const isLight = theme.scheme === 'light';

  return StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      padding: 14,
      gap: 12,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    accuracyTiles: {
      flexDirection: 'row',
      gap: 10,
    },
    accuracyTile: {
      flex: 1,
      minHeight: 72,
      borderRadius: 12,
      padding: 12,
      justifyContent: 'space-between',
    },
    playerTile: {
      backgroundColor: isLight ? '#eeeed2' : '#d8d8bc',
    },
    opponentTile: {
      backgroundColor: isLight ? '#4a4a4a' : '#262421',
    },
    playerTileLabel: {
      color: isLight ? 'rgba(28, 25, 22, 0.68)' : 'rgba(28, 25, 22, 0.72)',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    playerTileValue: {
      color: isLight ? '#1c1916' : '#141210',
      fontSize: 28,
      fontWeight: '800',
    },
    opponentTileLabel: {
      color: 'rgba(255, 255, 255, 0.78)',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    opponentTileValue: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '800',
    },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 4,
    },
    tableHeaderText: {
      flex: 1,
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    tableLabelCol: {
      flex: 1.4,
    },
    tableLabel: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    tableCount: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    badgeCol: {
      flex: 1,
      alignItems: 'center',
    },
  });
}
