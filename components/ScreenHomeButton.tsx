import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActionLeadingIcon from './ActionLeadingIcon';
import { IconButton } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import { SCREEN_BACK_BUTTON_LEFT, SCREEN_BACK_BUTTON_TOP } from './ScreenBackButton';

export const SCREEN_HOME_BUTTON_RIGHT = SCREEN_BACK_BUTTON_LEFT;
export const SCREEN_HOME_BUTTON_TOP = SCREEN_BACK_BUTTON_TOP;

type ScreenHomeButtonProps = {
  accessibilityLabel?: string;
};

export default function ScreenHomeButton({
  accessibilityLabel = 'Go home',
}: ScreenHomeButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <IconButton
      variant="accent"
      size="sm"
      style={[
        styles.button,
        {
          top: insets.top + SCREEN_HOME_BUTTON_TOP,
          right: SCREEN_HOME_BUTTON_RIGHT,
        },
      ]}
      onPress={() =>
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })
      }
      accessibilityLabel={accessibilityLabel}
    >
      <ActionLeadingIcon name="home" color={theme.accentText} size={18} />
    </IconButton>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    zIndex: 50,
    elevation: 50,
  },
});
