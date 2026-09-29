import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';

type DividerProps = {
  style?: StyleProp<ViewStyle>;
};

/** Hairline divider using the current theme's border color. */
export default function Divider({ style }: DividerProps) {
  const theme = useTheme();
  return <View style={[styles.line, { backgroundColor: theme.surfaceBorder }, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
