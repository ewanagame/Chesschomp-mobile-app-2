import { darkTheme } from './colors.dark';
import { lightTheme } from './colors.light';
import type { AppTheme, ColorScheme } from './types';

export type { AppTheme, ColorScheme } from './types';
export { darkTheme, lightTheme };

export { spacing } from './spacing';
export type { SpacingKey } from './spacing';
export { radii } from './radii';
export type { RadiiKey } from './radii';
export { typography } from './typography';
export type { TypographyKey } from './typography';
export { getShadow } from './shadows';
export type { ShadowLevel } from './shadows';

export function themeForScheme(scheme: ColorScheme): AppTheme {
  return scheme === 'light' ? lightTheme : darkTheme;
}
