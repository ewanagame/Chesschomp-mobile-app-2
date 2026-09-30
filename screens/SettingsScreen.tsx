import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import DragSlider from '../components/DragSlider';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { Card, SectionHeader } from '../components/ui';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  formatHistoryNavSpeedLabel,
  HISTORY_NAV_SPEED_MAX,
  HISTORY_NAV_SPEED_MIN,
  HISTORY_NAV_SPEED_STEP,
} from '../lib/holdRepeat';
import type { RootStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function AppearanceToggle({
  styles,
  theme,
}: {
  styles: ReturnType<typeof createSettingsStyles>;
  theme: AppTheme;
}) {
  const { preferences, setPreference } = useAppPreferences();
  const isLight = preferences.colorScheme === 'light';
  const modeLabel = isLight ? 'Light mode' : 'Dark mode';
  const modeDescription = isLight
    ? 'Use a light background on menus and game chrome. The chess board stays the same.'
    : 'Use a dark background on menus and game chrome. The chess board stays the same.';

  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{modeLabel}</Text>
        <Text style={styles.toggleDescription}>{modeDescription}</Text>
      </View>
      <Switch
        value={isLight}
        onValueChange={(next) => setPreference('colorScheme', next ? 'light' : 'dark')}
        trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
        thumbColor={isLight ? theme.switchThumbOn : theme.switchThumbOff}
        accessibilityRole="switch"
        accessibilityLabel={modeLabel}
        accessibilityState={{ checked: isLight }}
      />
    </View>
  );
}

function HistorySpeedSlider({
  label,
  description,
  value,
  onValueChange,
  styles,
}: {
  label: string;
  description: string;
  value: number;
  onValueChange: (next: number) => void;
  styles: ReturnType<typeof createSettingsStyles>;
}) {
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{formatHistoryNavSpeedLabel(value)}</Text>
      </View>
      <Text style={styles.toggleDescription}>{description}</Text>
      <DragSlider
        value={value}
        min={HISTORY_NAV_SPEED_MIN}
        max={HISTORY_NAV_SPEED_MAX}
        step={HISTORY_NAV_SPEED_STEP}
        onValueChange={onValueChange}
        accessibilityLabel={label}
      />
      <View style={styles.sliderEnds}>
        <Text style={styles.sliderEndLabel}>{formatHistoryNavSpeedLabel(HISTORY_NAV_SPEED_MIN)}</Text>
        <Text style={styles.sliderEndLabel}>{formatHistoryNavSpeedLabel(HISTORY_NAV_SPEED_MAX)}</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen({ navigation, route }: SettingsScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createSettingsStyles(theme), [theme]);
  const { preferences, setPreference } = useAppPreferences();
  const scrollRef = useRef<ScrollView>(null);
  const shouldScrollToSavingGames = route.params?.scrollTo === 'savingGames';

  const handleSavingGamesLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!shouldScrollToSavingGames) {
        return;
      }
      const y = event.nativeEvent.layout.y;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: true });
      });
    },
    [shouldScrollToSavingGames],
  );

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
          <Text style={styles.title}>Settings</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.sectionCard}>
            <SectionHeader title="Appearance" />
            <AppearanceToggle styles={styles} theme={theme} />
          </Card>

          <Card style={[styles.sectionCard, styles.sectionCardSpaced]}>
            <SectionHeader title="Move buttons" />
            <HistorySpeedSlider
              label="Hold speed"
              description="Hold < or > to step through moves at this speed, forward or back."
              value={preferences.historyHoldSpeed}
              onValueChange={(next) => setPreference('historyHoldSpeed', next)}
              styles={styles}
            />
            <HistorySpeedSlider
              label="Double-tap hold speed"
              description="Double-tap and keep holding < or > to step through moves at this faster speed."
              value={preferences.historyDoubleHoldSpeed}
              onValueChange={(next) => setPreference('historyDoubleHoldSpeed', next)}
              styles={styles}
            />
          </Card>

          <Card style={[styles.sectionCard, styles.sectionCardSpaced]} onLayout={handleSavingGamesLayout}>
            <SectionHeader title="About Saving Games" />
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>PGN</Text>
              <Text style={styles.toggleDescription}>
                PGN saves the whole game — every move from start to finish, like a replay. Use it if you
                want to look back at the whole game later or check it with a chess analysis tool.
              </Text>
            </View>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>FEN</Text>
              <Text style={styles.toggleDescription}>
                FEN saves a photo of the board — just what it looks like right now, with no moves. Use it
                if you want to remember one position, like a puzzle or a spot you want to come back to.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to home" />
    </View>
  );
}

function createSettingsStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
    },
    title: {
      color: theme.textPrimary,
      ...typography.title,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl + spacing.xs,
    },
    sectionCard: {
      gap: spacing.xl - 2,
    },
    sectionCardSpaced: {
      marginTop: spacing.lg,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: spacing.xs + 2,
    },
    toggleCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    toggleLabel: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    toggleDescription: {
      color: theme.textFaint,
      fontSize: 13,
      lineHeight: 18,
    },
    sliderBlock: {
      gap: spacing.xs,
    },
    sliderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    sliderValue: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    sliderEnds: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: -spacing.sm,
    },
    sliderEndLabel: {
      color: theme.textFaint,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
