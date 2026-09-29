import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ScreenBackButton, { SCREEN_BACK_BUTTON_HEIGHT } from '../components/ScreenBackButton';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { SectionHeader } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import {
  LICENSE_SECTIONS,
  LICENSES_SCREEN_TITLE,
  type LicenseBullet,
  type LicenseLink,
} from '../lib/licensesContent';
import type { RootStackParamList } from '../navigation/types';
import { spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type LicensesScreenProps = NativeStackScreenProps<RootStackParamList, 'Licenses'>;

const HORIZONTAL_PADDING = 20;

function LicenseLinkText({
  link,
  styles,
}: {
  link: LicenseLink;
  styles: ReturnType<typeof createLicensesStyles>;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(link.url)}
      accessibilityRole="link"
      accessibilityLabel={link.label}
    >
      <Text style={styles.link}>{link.label}</Text>
    </Pressable>
  );
}

function LicenseBulletRow({
  bullet,
  styles,
}: {
  bullet: LicenseBullet;
  styles: ReturnType<typeof createLicensesStyles>;
}) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletLabel}>{bullet.label}:</Text>
      <Text style={styles.bulletBody}>{bullet.body}</Text>
      {bullet.link ? <LicenseLinkText link={bullet.link} styles={styles} /> : null}
    </View>
  );
}

export default function LicensesScreen({ navigation }: LicensesScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createLicensesStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonSpacer} />
          <Text style={styles.title}>{LICENSES_SCREEN_TITLE}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {LICENSE_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <SectionHeader title={section.title} variant="accent" />
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
              {section.bullets?.map((bullet) => (
                <LicenseBulletRow key={bullet.label} bullet={bullet} styles={styles} />
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
      <ScreenBackButton onPress={() => navigation.goBack()} accessibilityLabel="Back to home" />
    </View>
  );
}

function createLicensesStyles(theme: AppTheme) {
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
      gap: spacing.xs,
    },
    backButtonSpacer: {
      height: SCREEN_BACK_BUTTON_HEIGHT,
      marginBottom: spacing.xs,
    },
    title: {
      color: theme.textPrimary,
      ...typography.title,
    },
    scrollContent: {
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingTop: spacing.lg,
      paddingBottom: spacing.huge,
      gap: spacing.xxl + spacing.xs,
    },
    section: {
      gap: spacing.md - 2,
    },
    paragraph: {
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 22,
    },
    bulletRow: {
      gap: 4,
      paddingLeft: 4,
    },
    bulletLabel: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    bulletBody: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    link: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      textDecorationLine: 'underline',
    },
  });
}
