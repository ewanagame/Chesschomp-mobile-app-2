import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { spacing, typography } from '../../theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /**
   * 'eyebrow' — small uppercase muted label used inside a Card (Settings,
   * Board Features, Free Board Modes).
   * 'accent' — larger accent-colored heading used for standalone sections
   * (Bot Roster categories, Licenses sections).
   */
  variant?: 'eyebrow' | 'accent';
  style?: StyleProp<ViewStyle>;
};

/**
 * Unified section header so every screen uses the same two header
 * treatments instead of ad-hoc font sizes/colors per screen.
 */
export default function SectionHeader({ title, subtitle, variant = 'eyebrow', style }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text
        style={
          variant === 'eyebrow'
            ? [typography.eyebrow, { color: theme.sectionLabel }]
            : [typography.subtitle, { color: theme.accentText }]
        }
      >
        {title}
      </Text>
      {subtitle ? <Text style={[typography.caption, { color: theme.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
