import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import MoveClassificationBadge, {
  CLASSIFICATION_BADGE_STYLES,
} from './MoveClassificationBadge';
import { useTheme } from '../contexts/ThemeContext';
import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import type { AppTheme } from '../theme';
import { classificationDisplayName } from '../utils/accuracyReport';

type ReviewMoveSummaryProps = {
  record: ClassifiedMoveRecord | null;
  openingName?: string | null;
};

function summaryPhrase(record: ClassifiedMoveRecord): string {
  const label = classificationDisplayName(record.classification).toLowerCase();
  if (record.classification === 'Best') {
    return `${record.san} is the best move`;
  }
  if (record.classification === 'Blunder') {
    return `${record.san} is a blunder`;
  }
  if (record.classification === 'Brilliant') {
    return `${record.san} is brilliant`;
  }
  if (record.classification === 'Great') {
    return `${record.san} is a great move`;
  }
  return `${record.san} is ${label.startsWith('a') || label.startsWith('e') || label.startsWith('i') || label.startsWith('o') || label.startsWith('u') ? 'an' : 'a'} ${label}`;
}

export default function ReviewMoveSummary({ record, openingName }: ReviewMoveSummaryProps) {
  const theme = useTheme();
  const styles = useMemo(() => createReviewMoveSummaryStyles(theme), [theme]);

  const badgeStyle = record ? CLASSIFICATION_BADGE_STYLES[record.classification] : null;
  const phrase = record ? summaryPhrase(record) : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {record && badgeStyle && phrase ? (
          <>
            <MoveClassificationBadge classification={record.classification} size={28} />
            <Text style={[styles.phrase, { color: badgeStyle.backgroundColor }]} numberOfLines={1}>
              {phrase}
            </Text>
          </>
        ) : (
          <Text style={styles.placeholder} numberOfLines={1}>
            Select a move to see its evaluation.
          </Text>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.openingName} numberOfLines={1}>
          {openingName ?? ' '}
        </Text>
      </View>
    </View>
  );
}

function createReviewMoveSummaryStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      overflow: 'hidden',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      height: 56,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    phrase: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    openingName: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
    },
    placeholder: {
      flex: 1,
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 22,
    },
  });
}
