import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppImage from '../components/AppImage';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import ScreenHomeButton from '../components/ScreenHomeButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { Button } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { getBotById, getBotImageSource } from '../lib/bots';
import type { RootStackParamList } from '../navigation/types';
import { radii, spacing } from '../theme';
import type { AppTheme } from '../theme';

type BotDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'BotDetail'>;

const HORIZONTAL_PADDING = 20;

export default function BotDetailScreen({ navigation, route }: BotDetailScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createBotDetailStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const bot = getBotById(route.params.botId);
  const imageSize = Math.min(width - HORIZONTAL_PADDING * 2, 320);

  useEffect(() => {
    if (!bot) {
      navigation.goBack();
    }
  }, [bot, navigation]);

  if (!bot) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.imageFrame, { width: imageSize, height: imageSize }]}>
            <AppImage source={getBotImageSource(bot, theme.scheme)} style={styles.image} resizeMode="cover" />
          </View>

          <Text style={styles.name}>{bot.name}</Text>
          <Text style={styles.species}>{bot.species}</Text>
          <Text style={styles.elo}>Elo: {bot.elo}</Text>
          <Text style={styles.level}>Level: {bot.level}</Text>
          <Text style={styles.funDescription}>{bot.funDescription}</Text>

          <View style={styles.actions}>
            <Button
              label="Play"
              variant="primary"
              onPress={() => navigation.navigate('Board', { mode: 'bot', botId: bot.id })}
              accessibilityLabel={`Play against ${bot.name}`}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton
        onPress={() => navigation.goBack()}
        accessibilityLabel="Back to bot roster"
      />
      <ScreenHomeButton />
    </View>
  );
}

function createBotDetailStyles(theme: AppTheme) {
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
      paddingBottom: spacing.xs,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingTop: spacing.md,
      paddingBottom: spacing.massive,
      gap: spacing.lg,
    },
    imageFrame: {
      borderRadius: radii.xxl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.cardBackground,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    name: {
      color: theme.textPrimary,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    species: {
      color: theme.sectionLabel,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: -8,
    },
    elo: {
      color: theme.accentText,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    level: {
      color: theme.textMuted,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    funDescription: {
      color: theme.textMuted,
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 24,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 8,
    },
    actions: {
      width: '100%',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
  });
}
