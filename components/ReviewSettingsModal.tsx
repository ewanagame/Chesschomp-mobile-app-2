import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import DragSlider from './DragSlider';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  formatReviewDepthLabel,
  REVIEW_DEPTH_MAX,
  REVIEW_DEPTH_MIN,
  REVIEW_DEPTH_STEP,
  reviewDepthHint,
} from '../lib/reviewSettings';
import type { AppTheme } from '../theme';

type ReviewSettingsModalProps = {
  visible: boolean;
  plyCount: number;
  onClose: () => void;
  onDepthChanged?: () => void;
};

export default function ReviewSettingsModal({
  visible,
  plyCount,
  onClose,
  onDepthChanged,
}: ReviewSettingsModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createReviewSettingsModalStyles(theme), [theme]);
  const { preferences, setPreference } = useAppPreferences();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Post-Game Evaluation settings</Text>

          <View style={styles.block}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>Stockfish depth</Text>
              <Text style={styles.value}>{formatReviewDepthLabel(preferences.reviewDepth)}</Text>
            </View>
            <Text style={styles.description}>
              {reviewDepthHint(preferences.reviewDepth, plyCount)}
            </Text>
            <DragSlider
              value={preferences.reviewDepth}
              min={REVIEW_DEPTH_MIN}
              max={REVIEW_DEPTH_MAX}
              step={REVIEW_DEPTH_STEP}
              onValueChange={(next) => {
                setPreference('reviewDepth', next);
                onDepthChanged?.();
              }}
              accessibilityLabel="Stockfish evaluation depth"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.label}>Show best move arrows</Text>
              <Text style={styles.description}>Draw an arrow for the engine best move.</Text>
            </View>
            <Switch
              value={preferences.reviewShowBestMoveArrows}
              onValueChange={(next) => setPreference('reviewShowBestMoveArrows', next)}
              trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
              thumbColor={
                preferences.reviewShowBestMoveArrows ? theme.switchThumbOn : theme.switchThumbOff
              }
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close post-game evaluation settings"
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createReviewSettingsModalStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.modalBackdrop,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.modalBorder,
      backgroundColor: theme.modalCard,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 18,
      gap: 18,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
    },
    block: {
      gap: 8,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    },
    label: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    value: {
      color: theme.accentSoftText,
      fontSize: 14,
      fontWeight: '700',
    },
    description: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    toggleCopy: {
      flex: 1,
      gap: 4,
    },
    closeButton: {
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    closeButtonPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    closeButtonText: {
      color: theme.accentText,
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
