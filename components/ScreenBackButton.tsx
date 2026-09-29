import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from './ui';
import { useTheme } from '../contexts/ThemeContext';

export const SCREEN_BACK_BUTTON_LEFT = 20;
export const SCREEN_BACK_BUTTON_TOP = 8;
export const SCREEN_BACK_BUTTON_HEIGHT = 36;

type ScreenBackButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
};

export default function ScreenBackButton({ onPress, accessibilityLabel }: ScreenBackButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <PressableScale
      style={[
        styles.button,
        {
          top: insets.top + SCREEN_BACK_BUTTON_TOP,
          left: SCREEN_BACK_BUTTON_LEFT,
          borderColor: theme.backButtonBorder,
          backgroundColor: theme.backButtonBackground,
        },
      ]}
      pressedStyle={{ backgroundColor: theme.backButtonBackgroundPressed }}
      hitSlop={8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.text, { color: theme.accentText }]}>← Back</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    zIndex: 50,
    elevation: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
