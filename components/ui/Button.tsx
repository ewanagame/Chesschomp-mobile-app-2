import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { radii, spacing, typography } from '../../theme';
import type { AppTheme } from '../../theme';
import PressableScale from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Small pill shown in the top-right corner, e.g. "Coming Soon". */
  badge?: string;
  leading?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Primary reusable button primitive. Covers the "primary" accent-filled
 * action, a "secondary" outlined action, a low-emphasis "ghost" action, and
 * a "destructive" action (resign/delete/etc.), all driven by theme tokens.
 */
export default function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'lg',
  disabled = false,
  badge,
  leading,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const styles = variantStyles(theme, variant, size);
  const isDisabled = Boolean(disabled);
  const [pressed, setPressed] = useState(false);

  return (
    <PressableScale
      testID={testID}
      style={[styles.base, pressed && !isDisabled && styles.pressed, isDisabled && styles.disabled, style]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${accessibilityLabel ?? label}, ${badge}` : accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
    >
      {badge ? (
        <View
          style={[styles.badge, { backgroundColor: theme.badgeBackground, borderColor: theme.badgeBorder }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[typography.footnote, { color: theme.badgeText }]}>{badge}</Text>
        </View>
      ) : null}
      <View style={styles.content}>
        {leading}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

function variantStyles(theme: AppTheme, variant: ButtonVariant, size: ButtonSize) {
  const paddingVertical = size === 'lg' ? spacing.lg : spacing.md;
  const fontSize = size === 'lg' ? typography.button.fontSize : typography.buttonSmall.fontSize;

  const palette: Record<ButtonVariant, { border: string; bg: string; bgPressed: string; text: string }> = {
    primary: {
      border: theme.accentBorderStrong,
      bg: theme.accentSurface,
      bgPressed: theme.accentSurfacePressed,
      text: theme.accentSoftText,
    },
    secondary: {
      border: theme.accentSoftBorder,
      bg: theme.cardBackground,
      bgPressed: theme.surfaceBackgroundPressed,
      text: theme.textSecondary,
    },
    ghost: {
      border: theme.cardBorder,
      bg: 'transparent',
      bgPressed: theme.surfaceBackgroundPressed,
      text: theme.textSecondary,
    },
    destructive: {
      border: theme.destructiveBorder,
      bg: theme.destructiveSurface,
      bgPressed: theme.destructiveSurface,
      text: theme.destructiveText,
    },
  };

  const colors = palette[variant];

  return StyleSheet.create({
    base: {
      position: 'relative',
      minHeight: size === 'lg' ? 56 : 46,
      paddingVertical,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.lg,
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
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    label: {
      color: colors.text,
      fontSize,
      fontWeight: '700',
    },
    badge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.md,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radii.xs,
      borderWidth: StyleSheet.hairlineWidth,
    },
  });
}
