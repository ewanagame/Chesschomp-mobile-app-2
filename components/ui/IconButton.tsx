import { useState, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { radii } from '../../theme';
import type { AppTheme } from '../../theme';
import PressableScale from './PressableScale';

export type IconButtonVariant = 'default' | 'accent' | 'destructive';
export type IconButtonSize = 'sm' | 'md' | 'lg';

type IconButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
};

const SIZE_MAP: Record<IconButtonSize, number> = {
  sm: 40,
  md: 44,
  lg: 52,
};

/**
 * Circular icon-only button. Use for back buttons, settings gear, menu
 * ellipsis, lock toggle, etc. so every icon control shares one shape
 * language instead of ad-hoc radii per component.
 */
export default function IconButton({
  children,
  onPress,
  variant = 'default',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  style,
  hitSlop = 8,
}: IconButtonProps) {
  const theme = useTheme();
  const dimension = SIZE_MAP[size];
  const styles = variantStyles(theme, dimension, variant);
  const [pressed, setPressed] = useState(false);

  return (
    <PressableScale
      style={[styles.base, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={hitSlop}
    >
      {children}
    </PressableScale>
  );
}

function variantStyles(theme: AppTheme, dimension: number, variant: IconButtonVariant) {
  const palette: Record<IconButtonVariant, { border: string; bg: string; bgPressed: string }> = {
    default: {
      border: theme.iconButtonBorder,
      bg: theme.iconButtonBackground,
      bgPressed: theme.iconButtonBackgroundPressed,
    },
    accent: {
      border: theme.accentBorder,
      bg: theme.accentSurface,
      bgPressed: theme.accentSurfacePressed,
    },
    destructive: {
      border: theme.destructiveBorder,
      bg: theme.destructiveSurface,
      bgPressed: theme.destructiveSurface,
    },
  };
  const colors = palette[variant];

  return StyleSheet.create({
    base: {
      width: dimension,
      height: dimension,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      backgroundColor: colors.bgPressed,
    },
    disabled: {
      opacity: 0.38,
    },
  });
}
