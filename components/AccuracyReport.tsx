import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MoveClassificationBadge, {
  CLASSIFICATION_BADGE_STYLES,
} from './MoveClassificationBadge';
import { useTheme } from '../contexts/ThemeContext';
import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import type { AppTheme } from '../theme';
import {
  buildAccuracyReportData,
  classificationDisplayName,
  notableMovesFromReport,
  REPORT_CLASSIFICATION_ORDER,
  type SideAccuracyStats,
} from '../utils/accuracyReport';
import type { MoveClassification } from '../utils/moveClassification';

type AccuracyReportProps = {
  visible: boolean;
  onClose: () => void;
  moves: readonly ClassifiedMoveRecord[];
  gameResult: string;
  openingName?: string | null;
};

type AccuracyReportStyles = ReturnType<typeof createAccuracyReportStyles>;

function formatAccuracy(accuracy: number): string {
  return `${accuracy.toFixed(1)}%`;
}

function SideSection({
  title,
  stats,
  styles,
}: {
  title: string;
  stats: SideAccuracyStats;
  styles: AccuracyReportStyles;
}) {
  const breakdownItems = REPORT_CLASSIFICATION_ORDER.filter(
    (classification) => stats.breakdown[classification] > 0,
  );

  return (
    <View style={styles.sideSection}>
      <View style={styles.sideHeader}>
        <Text style={styles.sideTitle}>{title}</Text>
        <Text style={styles.accuracyValue}>{formatAccuracy(stats.accuracy)}</Text>
      </View>
      <Text style={styles.accuracyLabel}>Accuracy</Text>
      <Text style={styles.moveCount}>
        {stats.moveCount} move{stats.moveCount === 1 ? '' : 's'} analyzed
      </Text>

      {breakdownItems.length > 0 ? (
        <View style={styles.breakdownList}>
          {breakdownItems.map((classification) => (
            <BreakdownRow
              key={classification}
              classification={classification}
              count={stats.breakdown[classification]}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyBreakdown}>No moves recorded for this side.</Text>
      )}
    </View>
  );
}

function BreakdownRow({
  classification,
  count,
  styles,
}: {
  classification: MoveClassification;
  count: number;
  styles: AccuracyReportStyles;
}) {
  const badgeStyle = CLASSIFICATION_BADGE_STYLES[classification];

  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownBadgeWrap}>
        <MoveClassificationBadge classification={classification} size={22} />
      </View>
      <Text style={styles.breakdownLabel}>{classificationDisplayName(classification)}</Text>
      <View style={[styles.breakdownCountPill, { backgroundColor: badgeStyle.backgroundColor }]}>
        <Text style={styles.breakdownCount}>{count}</Text>
      </View>
    </View>
  );
}

function NotableMoveRow({
  move,
  styles,
}: {
  move: ClassifiedMoveRecord;
  styles: AccuracyReportStyles;
}) {
  const side = move.color === 'w' ? 'White' : 'Black';
  const detail =
    move.missedWinDetail ??
    (move.forced ? 'Only legal move available' : null);
  const qualityLabel = classificationDisplayName(move.classification);
  const titleLabel = move.missedWin ? `${qualityLabel} — Missed Win` : qualityLabel;

  return (
    <View style={styles.notableMoveRow}>
      <View style={styles.notableMoveHeader}>
        <View style={styles.notableMoveBadges}>
          <MoveClassificationBadge classification={move.classification} size={22} />
          {move.missedWin ? (
            <MoveClassificationBadge classification="MissedWin" size={18} />
          ) : null}
        </View>
        <Text style={styles.notableMoveTitle}>
          {side} · {move.san} · {titleLabel}
        </Text>
      </View>
      {detail ? <Text style={styles.notableMoveDetail}>{detail}</Text> : null}
    </View>
  );
}

export type AccuracyReportContentProps = {
  moves: readonly ClassifiedMoveRecord[];
  gameResult: string;
  openingName?: string | null;
  onClose: () => void;
};

export function AccuracyReportContent({
  moves,
  gameResult,
  openingName,
  onClose,
}: AccuracyReportContentProps) {
  const theme = useTheme();
  const styles = useMemo(() => createAccuracyReportStyles(theme), [theme]);
  const report = buildAccuracyReportData(moves);
  const notableMoves = notableMovesFromReport(moves);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Post-Game Evaluation</Text>
        <Text style={styles.result}>{gameResult}</Text>
        {openingName ? (
          <Text style={styles.openingName}>Opening: {openingName}</Text>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SideSection title="White" stats={report.white} styles={styles} />
          <View style={styles.divider} />
          <SideSection title="Black" stats={report.black} styles={styles} />

          {notableMoves.length > 0 ? (
            <>
              <View style={styles.divider} />
              <View style={styles.notableSection}>
                <Text style={styles.notableSectionTitle}>Notable moves</Text>
                {notableMoves.map((move) => (
                  <NotableMoveRow key={`${move.move}-${move.fenBefore}`} move={move} styles={styles} />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        <Pressable
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close post-game evaluation"
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AccuracyReport({
  visible,
  onClose,
  moves,
  gameResult,
  openingName,
}: AccuracyReportProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <AccuracyReportContent
        moves={moves}
        gameResult={gameResult}
        openingName={openingName}
        onClose={onClose}
      />
    </Modal>
  );
}

function createAccuracyReportStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.modalBackdrop,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.modalBorder,
      backgroundColor: theme.modalCard,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 12,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    result: {
      marginTop: 8,
      marginBottom: 18,
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
    },
    openingName: {
      marginTop: -10,
      marginBottom: 18,
      color: theme.sectionLabel,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 18,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingBottom: 8,
    },
    sideSection: {
      gap: 6,
    },
    sideHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    sideTitle: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    accuracyValue: {
      color: theme.accuracyGreen,
      fontSize: 28,
      fontWeight: '800',
    },
    accuracyLabel: {
      color: theme.textFaint,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    moveCount: {
      color: theme.textFaint,
      fontSize: 13,
      marginBottom: 8,
    },
    breakdownList: {
      gap: 8,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    breakdownBadgeWrap: {
      width: 24,
      alignItems: 'center',
    },
    breakdownLabel: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    breakdownCountPill: {
      minWidth: 28,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      alignItems: 'center',
    },
    breakdownCount: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    emptyBreakdown: {
      color: theme.textFaint,
      fontSize: 14,
      fontStyle: 'italic',
    },
    notableSection: {
      gap: 12,
    },
    notableSectionTitle: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    notableMoveRow: {
      gap: 4,
      paddingVertical: 4,
    },
    notableMoveHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    notableMoveBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    notableMoveTitle: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
    notableMoveDetail: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      paddingLeft: 32,
    },
    divider: {
      height: 1,
      backgroundColor: theme.surfaceBorder,
      marginVertical: 18,
    },
    closeButton: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
      alignItems: 'center',
    },
    closeButtonPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    closeButtonText: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
