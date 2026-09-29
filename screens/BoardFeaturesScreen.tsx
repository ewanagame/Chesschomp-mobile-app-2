import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import DragSlider, { SLIDER_TRACK_TOP } from '../components/DragSlider';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { Card, SectionHeader } from '../components/ui';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useTheme } from '../contexts/ThemeContext';
import type { AppPreferenceKey } from '../lib/appPreferences';
import {
  classificationMovetimeHint,
  formatClassificationMovetimeLabel,
  recommendedMarkLeftPercent,
  sliderThumbCenterX,
} from '../lib/classificationMovetime';
import { formatReviewDepthLabel, reviewDepthHint } from '../lib/reviewSettings';
import { SETTINGS_ROWS, type SettingsSliderRow, type SettingsToggleRow } from '../lib/settingsConfig';
import type { RootStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type BoardFeaturesScreenProps = NativeStackScreenProps<RootStackParamList, 'BoardFeatures'>;

function SettingsToggle({
  row,
  value,
  onValueChange,
  styles,
  theme,
}: {
  row: SettingsToggleRow;
  value: boolean;
  onValueChange: (next: boolean) => void;
  styles: ReturnType<typeof createBoardFeaturesStyles>;
  theme: AppTheme;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{row.label}</Text>
        {row.description ? <Text style={styles.toggleDescription}>{row.description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
        thumbColor={value ? theme.switchThumbOn : theme.switchThumbOff}
        accessibilityRole="switch"
        accessibilityLabel={row.accessibilityLabel ?? row.label}
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

function SettingsSlider({
  row,
  value,
  onValueChange,
  styles,
}: {
  row: SettingsSliderRow;
  value: number;
  onValueChange: (next: number) => void;
  styles: ReturnType<typeof createBoardFeaturesStyles>;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const hint =
    row.key === 'reviewDepth' ? reviewDepthHint(value, 40) : classificationMovetimeHint(value);
  const valueLabel =
    row.key === 'reviewDepth' ? formatReviewDepthLabel(value) : formatClassificationMovetimeLabel(value);
  const recommendedLeftPercent = recommendedMarkLeftPercent(row.recommended, row.min, row.max);
  const recommendedCenterX = sliderThumbCenterX(
    row.recommended,
    row.min,
    row.max,
    trackWidth,
  );

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.toggleLabel}>{row.label}</Text>
        <Text style={styles.sliderValue}>
          {valueLabel}
          {value === row.recommended ? ' · Recommended' : ''}
        </Text>
      </View>
      {row.description ? <Text style={styles.toggleDescription}>{row.description}</Text> : null}
      <Text style={styles.sliderHint}>{hint}</Text>

      <View style={styles.sliderTrackWrap}>
        <View pointerEvents="none" style={styles.recommendedLabelRow}>
          <View
            style={[
              styles.recommendedMarkWrap,
              trackWidth > 0
                ? { left: recommendedCenterX }
                : { left: `${recommendedLeftPercent}%` },
            ]}
          >
            <Text style={styles.recommendedMarkText}>Recommended</Text>
          </View>
        </View>

        <View style={styles.sliderTrackArea} onLayout={handleTrackLayout}>
          <View pointerEvents="none" style={styles.recommendedTrackTickWrap}>
            <View
              style={[
                styles.recommendedTrackTick,
                trackWidth > 0
                  ? { left: recommendedCenterX }
                  : { left: `${recommendedLeftPercent}%` },
              ]}
            />
          </View>
          <DragSlider
            value={value}
            min={row.min}
            max={row.max}
            step={row.step}
            onValueChange={onValueChange}
            accessibilityLabel={row.accessibilityLabel ?? row.label}
          />
        </View>

        <View pointerEvents="none" style={styles.sliderMarksRow}>
          <Text style={styles.sliderMarkText}>Fast</Text>
          <Text style={styles.sliderMarkText}>Deep</Text>
        </View>
      </View>
    </View>
  );
}

export default function BoardFeaturesScreen({ navigation }: BoardFeaturesScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createBoardFeaturesStyles(theme), [theme]);
  const { preferences, setPreference } = useAppPreferences();

  const handleToggleChange = (key: AppPreferenceKey, next: boolean) => {
    setPreference(key, next);
  };

  const handleSliderChange = (key: AppPreferenceKey, next: number) => {
    setPreference(key, next);
  };

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
          <Text style={styles.title}>Board Features</Text>
          <Text style={styles.subtitle}>Sounds, animations, and move ratings on the board.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.sectionCard}>
            <SectionHeader title="Board Options" />
            {SETTINGS_ROWS.map((row) => {
              if (row.kind === 'slider') {
                return (
                  <SettingsSlider
                    key={row.key}
                    row={row}
                    value={preferences[row.key] as number}
                    onValueChange={(next) => handleSliderChange(row.key, next)}
                    styles={styles}
                  />
                );
              }

              if (row.kind === 'toggle') {
                return (
                  <SettingsToggle
                    key={row.key}
                    row={row}
                    value={preferences[row.key] as boolean}
                    onValueChange={(next) => handleToggleChange(row.key, next)}
                    styles={styles}
                    theme={theme}
                  />
                );
              }

              return null;
            })}
          </Card>
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to home" />
    </View>
  );
}

function createBoardFeaturesStyles(theme: AppTheme) {
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
      gap: spacing.sm,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
    },
    title: {
      color: theme.textPrimary,
      ...typography.title,
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl + spacing.xs,
    },
    sectionCard: {
      gap: spacing.lg - 2,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    toggleCopy: {
      flex: 1,
      gap: 4,
    },
    toggleLabel: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    toggleDescription: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },
    sliderBlock: {
      gap: 8,
    },
    sliderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sliderValue: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: '700',
      flexShrink: 0,
    },
    sliderHint: {
      color: theme.textFaint,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    sliderTrackWrap: {
      gap: 6,
      paddingTop: 18,
    },
    recommendedLabelRow: {
      height: 16,
      position: 'relative',
    },
    recommendedMarkWrap: {
      position: 'absolute',
      transform: [{ translateX: -42 }],
      width: 84,
      alignItems: 'center',
    },
    recommendedMarkText: {
      color: theme.sliderRecommended,
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
    },
    sliderTrackArea: {
      position: 'relative',
      minHeight: SLIDER_TRACK_TOP + 22,
    },
    recommendedTrackTickWrap: {
      ...StyleSheet.absoluteFill,
      zIndex: 1,
    },
    recommendedTrackTick: {
      position: 'absolute',
      top: SLIDER_TRACK_TOP,
      width: 2,
      height: 12,
      marginTop: -3,
      transform: [{ translateX: -1 }],
      backgroundColor: theme.sliderRecommendedTick,
      borderRadius: 1,
    },
    sliderMarksRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    sliderMarkText: {
      color: theme.sliderMark,
      fontSize: 11,
      fontWeight: '600',
    },
  });
}
