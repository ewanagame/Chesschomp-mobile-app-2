/**
 * Global spacing scale. Use these instead of ad-hoc numbers for padding,
 * margin, and gap so spacing stays consistent across screens.
 */
export const spacing = {
  /** 2px — hairline adjustments only */
  xxs: 2,
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px — default card/screen padding */
  lg: 16,
  /** 20px — default screen horizontal padding */
  xl: 20,
  /** 24px */
  xxl: 24,
  /** 32px */
  xxxl: 32,
  /** 40px */
  huge: 40,
  /** 48px */
  massive: 48,
} as const;

export type SpacingKey = keyof typeof spacing;
