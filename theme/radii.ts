/**
 * Global corner radius scale. Use these instead of ad-hoc borderRadius
 * numbers so cards, buttons, and tiles feel like one cohesive system.
 */
export const radii = {
  /** 6px — small badges/chips */
  xs: 6,
  /** 10px — compact controls (back button, small pills) */
  sm: 10,
  /** 12px — buttons, inputs */
  md: 12,
  /** 14px — standard cards, sheets, primary buttons */
  lg: 14,
  /** 16px — section cards, image tiles */
  xl: 16,
  /** 20px — hero imagery, large feature tiles */
  xxl: 20,
  /** fully rounded (circles / pills) */
  full: 999,
} as const;

export type RadiiKey = keyof typeof radii;
