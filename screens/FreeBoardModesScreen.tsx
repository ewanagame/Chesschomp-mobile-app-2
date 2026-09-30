import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppImage from '../components/AppImage';
import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { Button, Card, SectionHeader } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import {
  PLAY_TOGETHER_DESCRIPTION,
  PLAY_TOGETHER_IMAGE_ASPECT_RATIO,
  PLAY_TOGETHER_TAGLINE,
  PLAY_TOGETHER_TITLE,
  playTogetherImageSource,
} from '../lib/playTogetherContent';
import type { RootStackParamList } from '../navigation/types';
import { radii, spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type FreeBoardModesScreenProps = NativeStackScreenProps<RootStackParamList, 'FreeBoardModes'>;

export default function FreeBoardModesScreen({ navigation }: FreeBoardModesScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createFreeBoardModesStyles(theme), [theme]);

  const handleStartTwoPlayer = () => {
    navigation.navigate('Board', { mode: 'free', passAndPlay: true });
  };

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
          <Text style={styles.title}>Free Board Modes</Text>
          <Text style={styles.subtitle}>Pick how you want to play on the free board.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.sectionCard}>
            <SectionHeader title="Two Player" />
            <View style={styles.playTogetherCopy}>
              <Text style={styles.featureTitle}>{PLAY_TOGETHER_TITLE}</Text>
              <Text style={styles.featureTagline}>{PLAY_TOGETHER_TAGLINE}</Text>
            </View>
            <View style={styles.playTogetherFrame}>
              <AppImage
                source={playTogetherImageSource(theme.scheme)}
                style={styles.playTogetherImage}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel={`${PLAY_TOGETHER_TITLE} — ${PLAY_TOGETHER_TAGLINE}`}
              />
            </View>
            <Text style={styles.playTogetherDescription}>{PLAY_TOGETHER_DESCRIPTION}</Text>
            <Button
              label="Start Two Player"
              variant="primary"
              onPress={handleStartTwoPlayer}
              style={styles.startButton}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to board" />
    </View>
  );
}

function createFreeBoardModesStyles(theme: AppTheme) {
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
    playTogetherCopy: {
      gap: 2,
    },
    playTogetherFrame: {
      alignSelf: 'center',
      width: '90%',
      maxWidth: 322,
      aspectRatio: PLAY_TOGETHER_IMAGE_ASPECT_RATIO,
      borderRadius: radii.sm,
      overflow: 'hidden',
      backgroundColor: theme.scheme === 'dark' ? '#060606' : '#101014',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.surfaceBorder,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    playTogetherImage: {
      width: '100%',
      height: '100%',
    },
    playTogetherDescription: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    featureTitle: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    featureTagline: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: '700',
    },
    startButton: {
      marginTop: spacing.xs,
    },
  });
}
