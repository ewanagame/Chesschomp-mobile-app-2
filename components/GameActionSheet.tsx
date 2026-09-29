import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../theme';

const SHEET_SLIDE_DISTANCE = 320;
const OPEN_DURATION_MS = 220;
const CLOSE_DURATION_MS = 180;

export type GameActionSheetOption = {
  id: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type GameActionSheetProps = {
  visible: boolean;
  options: readonly GameActionSheetOption[];
  onCancel: () => void;
  /** Fires after the close animation finishes and the sheet has unmounted. */
  onDismissed?: () => void;
  extraContent?: ReactNode;
};

export default function GameActionSheet({
  visible,
  options,
  onCancel,
  onDismissed,
  extraContent,
}: GameActionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createGameActionSheetStyles(theme), [theme]);
  const progress = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(visible);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    progress.stopAnimation();

    if (visible) {
      mountedRef.current = true;
      setMounted(true);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!mountedRef.current) {
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        mountedRef.current = false;
        setMounted(false);
        onDismissed?.();
      }
    });
  }, [onDismissed, visible, progress]);

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sheetTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_SLIDE_DISTANCE, 0],
  });

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.optionsCard}>
            {options.map((option, index) => (
              <View key={option.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.optionRowPressed,
                  ]}
                  onPress={option.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option.destructive && styles.optionTextDestructive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              </View>
            ))}
            {extraContent ? (
              <>
                {options.length > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.extraContent}>{extraContent}</View>
              </>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
            ]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createGameActionSheetStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.modalBackdrop,
    },
    sheetContainer: {
      paddingHorizontal: 12,
      gap: 8,
    },
    optionsCard: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.modalBorder,
      backgroundColor: theme.modalCard,
    },
    optionRow: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: theme.modalCard,
    },
    optionRowPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    optionText: {
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
    optionTextDestructive: {
      color: theme.destructiveText,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.modalBorder,
    },
    extraContent: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 18,
      backgroundColor: theme.modalCard,
    },
    cancelButton: {
      minHeight: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.modalBorder,
      backgroundColor: theme.modalCard,
    },
    cancelButtonPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    cancelText: {
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
  });
}
