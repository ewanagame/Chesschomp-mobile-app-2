import { StyleSheet, Text, View } from 'react-native';

import type { MoveClassification } from '../utils/moveClassification';

type BadgeStyle = {
  backgroundColor: string;
  label: string;
  fontSize: number;
};

const BADGE_STYLES: Record<MoveClassification, BadgeStyle> = {
  Brilliant: { backgroundColor: '#1baaaa', label: '!!', fontSize: 9 },
  Best: { backgroundColor: '#6aaa3a', label: '★', fontSize: 11 },
  Excellent: { backgroundColor: '#96bc4b', label: '👍', fontSize: 9 },
  Good: { backgroundColor: '#7a9f5a', label: '✓', fontSize: 11 },
  Book: { backgroundColor: '#b58863', label: '📖', fontSize: 8 },
  Inaccuracy: { backgroundColor: '#e0b040', label: '?!', fontSize: 8 },
  Mistake: { backgroundColor: '#e6912c', label: '?', fontSize: 12 },
  Blunder: { backgroundColor: '#ca3431', label: '??', fontSize: 8 },
};

type MoveClassificationBadgeProps = {
  classification: MoveClassification;
  size: number;
};

export default function MoveClassificationBadge({
  classification,
  size,
}: MoveClassificationBadgeProps) {
  const badge = BADGE_STYLES[classification];

  return (
    <View
      pointerEvents="none"
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: badge.backgroundColor,
        },
      ]}
    >
      <Text style={[styles.label, { fontSize: badge.fontSize }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 4,
  },
  label: {
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
  },
});
