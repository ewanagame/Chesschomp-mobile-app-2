import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import AppImage from '../components/AppImage';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { IconButton, PressableScale } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { getBotImageSource, getBotsGroupedByCategory, type Bot } from '../lib/bots';
import type { RootStackParamList } from '../navigation/types';
import { getShadow, radii, spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type BotRosterScreenProps = NativeStackScreenProps<RootStackParamList, 'Bots'>;

const HORIZONTAL_PADDING = spacing.xl;
const CARD_GAP = spacing.md;
const SECTION_GAP = spacing.xl;
const WIDE_SCREEN_BREAKPOINT = 600;
const CONTROL_SIZE = 36;

type BotCardProps = {
  bot: Bot;
  size: number;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createBotRosterStyles>;
  /** Shifts a leftover card so a short last row sits in the middle of the grid. */
  offsetStyle?: { marginLeft: number };
};

function formatEloRange(bots: readonly Bot[]): string {
  const elos = bots.map((bot) => bot.elo);
  const min = Math.min(...elos);
  const max = Math.max(...elos);
  return min === max ? `${min} Elo` : `${min}–${max} Elo`;
}

function BotCard({ bot, size, selected, onPress, styles, offsetStyle }: BotCardProps) {
  const theme = useTheme();

  return (
    <PressableScale
      restingScale={selected ? 1.012 : 1}
      pressedScale={0.97}
      style={[styles.botCard, { width: size }, offsetStyle, selected && styles.botCardSelected]}
      pressedStyle={styles.botCardSelected}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${bot.name}, ${bot.elo} Elo`}
      accessibilityState={{ selected }}
    >
      <View style={styles.botCardClip}>
        <View style={[styles.botImageFrame, { height: size }]}>
          <AppImage source={getBotImageSource(bot, theme.scheme)} style={styles.botImage} resizeMode="cover" />
          <View
            style={styles.eloBadge}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.eloBadgeText}>{bot.elo} Elo</Text>
          </View>
        </View>
        <View style={styles.botNameWrap}>
          <Text style={styles.botName} numberOfLines={2}>
            {bot.name}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export default function BotRosterScreen({ navigation }: BotRosterScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createBotRosterStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const columns = width >= WIDE_SCREEN_BREAKPOINT ? 4 : 2;
  const cardSize = (width - HORIZONTAL_PADDING * 2 - CARD_GAP * (columns - 1)) / columns;
  const botGroups = getBotsGroupedByCategory();

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.navRow}>
            <View style={styles.backButtonSpacer} />
            <IconButton
              variant="default"
              size="sm"
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Open settings"
            >
              <Text style={styles.settingsIcon}>⚙</Text>
            </IconButton>
          </View>
          <Text style={styles.title}>Play vs Bots</Text>
          <Text style={styles.subtitle}>Choose your opponent</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {botGroups.map((group, groupIndex) => (
            <View
              key={group.category}
              style={[styles.section, groupIndex > 0 && styles.sectionSpaced]}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{group.label}</Text>
                <Text style={styles.sectionRange}>{formatEloRange(group.bots)}</Text>
              </View>
              <View style={styles.grid}>
                {group.bots.map((bot, botIndex) => {
                  const isLoneLastCard =
                    botIndex === group.bots.length - 1 && group.bots.length % columns === 1;
                  const loneOffset = isLoneLastCard
                    ? ((columns - 1) * (cardSize + CARD_GAP)) / 2
                    : 0;

                  return (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      size={cardSize}
                      selected={selectedBotId === bot.id}
                      styles={styles}
                      offsetStyle={loneOffset > 0 ? { marginLeft: loneOffset } : undefined}
                      onPress={() => {
                        setSelectedBotId(bot.id);
                        navigation.navigate('BotDetail', { botId: bot.id });
                      }}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to home" />
    </View>
  );
}

function createBotRosterStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      gap: spacing.xxs,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
      flex: 1,
    },
    settingsButton: {
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
    },
    settingsIcon: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 18,
    },
    title: {
      color: theme.textPrimary,
      ...typography.title,
    },
    subtitle: {
      color: theme.textMuted,
      ...typography.body,
    },
    scrollContent: {
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    section: {
      gap: spacing.sm,
    },
    sectionSpaced: {
      marginTop: SECTION_GAP,
    },
    sectionHeader: {
      gap: 2,
    },
    sectionTitle: {
      color: theme.accentText,
      ...typography.eyebrow,
    },
    sectionRange: {
      color: theme.textFaint,
      ...typography.footnote,
      fontWeight: '600',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CARD_GAP,
    },
    botCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      ...getShadow(theme, 'sm'),
    },
    botCardSelected: {
      borderColor: theme.accentBorderStrong,
      backgroundColor: theme.accentSurface,
      ...getShadow(theme, 'glow'),
    },
    botCardClip: {
      borderRadius: radii.xl - 1,
      overflow: 'hidden',
    },
    botImageFrame: {
      width: '100%',
      backgroundColor: theme.surfaceBackgroundSubtle,
    },
    botImage: {
      width: '100%',
      height: '100%',
    },
    eloBadge: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.xs,
      backgroundColor: theme.badgeBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.badgeBorder,
    },
    eloBadgeText: {
      color: theme.badgeText,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      includeFontPadding: false,
    },
    botNameWrap: {
      minHeight: 52,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botName: {
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}
