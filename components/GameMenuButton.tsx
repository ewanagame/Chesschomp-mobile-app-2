import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import DragSlider from './DragSlider';
import GameActionSheet, { type GameActionSheetOption } from './GameActionSheet';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  formatReviewPlaybackSpeedLabel,
  REVIEW_PLAYBACK_SPEED_MAX,
  REVIEW_PLAYBACK_SPEED_MIN,
  REVIEW_PLAYBACK_SPEED_STEP,
} from '../lib/reviewSettings';
import type { AppTheme } from '../theme';

type GameMenuButtonProps = {
  onFlipBoard: () => void;
  onResetBoard: () => void;
  onResign: () => void;
  onAbortGame: () => void;
  onSaveGame: () => void;
  onSaveReview?: () => void;
  showFlipBoard?: boolean;
  reviewOnlyFlipBoard?: boolean;
};

function GameMenuButton({
  onFlipBoard,
  onResetBoard,
  onResign,
  onAbortGame,
  onSaveGame,
  onSaveReview,
  showFlipBoard = true,
  reviewOnlyFlipBoard = false,
}: GameMenuButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => createGameMenuButtonStyles(theme), [theme]);
  const { preferences, setPreference } = useAppPreferences();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handleSheetDismissed = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  const openSheet = useCallback(() => {
    setSheetVisible(true);
  }, []);

  const runAfterClose = useCallback((action: () => void) => {
    pendingActionRef.current = action;
    setSheetVisible(false);
  }, []);

  const options = useMemo<readonly GameActionSheetOption[]>(
    () => {
      if (reviewOnlyFlipBoard) {
        return [
          ...(showFlipBoard
            ? [
                {
                  id: 'flip',
                  label: 'Flip board',
                  onPress: () => runAfterClose(onFlipBoard),
                } satisfies GameActionSheetOption,
              ]
            : []),
          ...(onSaveReview
            ? [
                {
                  id: 'save-review',
                  label: 'Save evaluation',
                  onPress: () => runAfterClose(onSaveReview),
                } satisfies GameActionSheetOption,
              ]
            : []),
        ];
      }

      return [
        ...(showFlipBoard
          ? [
              {
                id: 'flip',
                label: 'Flip board',
                onPress: () => runAfterClose(onFlipBoard),
              } satisfies GameActionSheetOption,
            ]
          : []),
        {
          id: 'reset',
          label: 'Reset board',
          onPress: () => runAfterClose(onResetBoard),
        },
        {
          id: 'resign',
          label: 'Resign',
          destructive: true,
          onPress: () => runAfterClose(onResign),
        },
        {
          id: 'abort',
          label: 'Abort game',
          destructive: true,
          onPress: () => runAfterClose(onAbortGame),
        },
        {
          id: 'save',
          label: 'Save game',
          onPress: () => runAfterClose(onSaveGame),
        },
      ];
    },
    [
      onAbortGame,
      onFlipBoard,
      onResetBoard,
      onResign,
      onSaveGame,
      onSaveReview,
      reviewOnlyFlipBoard,
      runAfterClose,
      showFlipBoard,
    ],
  );

  const reviewExtraContent = reviewOnlyFlipBoard ? (
      <View style={styles.playbackBlock}>
        <View style={styles.playbackHeader}>
          <Text style={styles.playbackLabel}>Playback speed</Text>
          <Text style={styles.playbackValue}>
            {formatReviewPlaybackSpeedLabel(preferences.reviewPlaybackSpeed)}
          </Text>
        </View>
        <DragSlider
          value={preferences.reviewPlaybackSpeed}
          min={REVIEW_PLAYBACK_SPEED_MIN}
          max={REVIEW_PLAYBACK_SPEED_MAX}
          step={REVIEW_PLAYBACK_SPEED_STEP}
          onValueChange={(next) => setPreference('reviewPlaybackSpeed', next)}
          accessibilityLabel="Post-game evaluation playback speed"
        />
      </View>
    ) : undefined;

  return (
    <>
      <Pressable
        style={[
          styles.menuButton,
          pressed && styles.menuButtonPressed,
          sheetVisible && styles.menuButtonActive,
        ]}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel="Open game menu"
        accessibilityState={{ expanded: sheetVisible }}
      >
        <Text style={styles.menuButtonIcon}>⋯</Text>
      </Pressable>
      <GameActionSheet
        visible={sheetVisible}
        options={options}
        extraContent={reviewExtraContent}
        onCancel={closeSheet}
        onDismissed={handleSheetDismissed}
      />
    </>
  );
}

export default memo(GameMenuButton);

function createGameMenuButtonStyles(theme: AppTheme) {
  return StyleSheet.create({
    menuButton: {
      minWidth: 52,
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.iconButtonBorder,
      backgroundColor: theme.iconButtonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuButtonPressed: {
      backgroundColor: theme.iconButtonBackgroundPressed,
      transform: [{ scale: 0.94 }],
    },
    menuButtonActive: {
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentSurface,
    },
    menuButtonIcon: {
      color: theme.textSecondary,
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 30,
      marginTop: -2,
    },
    playbackBlock: {
      gap: 4,
    },
    playbackHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    },
    playbackLabel: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    playbackValue: {
      color: theme.accentSoftText,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
