import type { ViewStyle } from 'react-native';
import type { AppTheme } from './types';

export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg' | 'glow';

/**
 * Returns a ready-to-spread shadow style for the given elevation level,
 * using the theme's shadow color so it stays correct in light and dark
 * mode. Use `glow` for accent-colored glows (pass a custom `glowColor`).
 */
export function getShadow(theme: AppTheme, level: ShadowLevel, glowColor?: string): ViewStyle {
  switch (level) {
    case 'none':
      return {};
    case 'sm':
      return {
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 2,
      };
    case 'md':
      return {
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 4,
      };
    case 'lg':
      return {
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        elevation: 8,
      };
    case 'glow':
      return {
        shadowColor: glowColor ?? theme.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.32,
        shadowRadius: 8,
        elevation: 4,
      };
    default:
      return {};
  }
}
