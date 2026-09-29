import type { TextStyle } from 'react-native';

/**
 * Global typography scale. Each entry is a ready-to-spread TextStyle
 * (size, weight, letter spacing). Colors are intentionally omitted —
 * combine with a theme text color token, e.g.:
 *
 *   style={[typography.title, { color: theme.textPrimary }]}
 */
export const typography = {
  /** Big hero title (Home screen mascot title) */
  display: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  /** Standard screen title */
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  /** Secondary/large section title (e.g. bot category headers) */
  subtitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  /** Card / modal heading */
  heading: {
    fontSize: 18,
    fontWeight: '800',
  },
  /** Uppercase eyebrow section label used inside cards */
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Emphasized body text (list titles, names) */
  bodyStrong: {
    fontSize: 16,
    fontWeight: '700',
  },
  /** Default body text */
  body: {
    fontSize: 15,
    fontWeight: '500',
  },
  /** Small supporting text */
  caption: {
    fontSize: 13,
    fontWeight: '600',
  },
  /** Smallest supporting text (meta, footnotes) */
  footnote: {
    fontSize: 12,
    fontWeight: '600',
  },
  /** Button label */
  button: {
    fontSize: 17,
    fontWeight: '700',
  },
  /** Small button / icon-button label */
  buttonSmall: {
    fontSize: 14,
    fontWeight: '700',
  },
} satisfies Record<string, TextStyle>;

export type TypographyKey = keyof typeof typography;
