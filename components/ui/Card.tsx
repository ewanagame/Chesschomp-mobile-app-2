import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { getShadow, radii, spacing } from '../../theme';
import type { ShadowLevel } from '../../theme';

type CardProps = ViewProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Visual weight of the surface. 'surface' is used for tappable list rows. */
  variant?: 'card' | 'surface';
  padding?: keyof typeof spacing | 'none';
  shadow?: ShadowLevel;
};

/**
 * Standard rounded, bordered surface used for section cards, list rows,
 * and grouped content throughout the app. Keeps radius/border/background
 * consistent instead of every screen defining its own "sectionCard" style.
 */
export default function Card({
  children,
  style,
  variant = 'card',
  padding = 'lg',
  shadow = 'none',
  ...viewProps
}: CardProps) {
  const theme = useTheme();
  const paddingValue = padding === 'none' ? 0 : spacing[padding];
  const background = variant === 'card' ? theme.cardBackground : theme.surfaceBackground;
  const border = variant === 'card' ? theme.cardBorder : theme.surfaceBorder;

  return (
    <View
      {...viewProps}
      style={[
        styles.base,
        {
          backgroundColor: background,
          borderColor: border,
          padding: paddingValue,
        },
        getShadow(theme, shadow),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
    borderWidth: 1,
  },
});
