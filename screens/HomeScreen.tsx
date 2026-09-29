import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ChessPiece } from '../components/chessPieces';
import NameGameModal from '../components/NameGameModal';
import PlayerPieceModal from '../components/PlayerPieceModal';
import WarmRadialBackground from '../components/WarmRadialBackground';
import { Card, Divider, IconButton, PressableScale } from '../components/ui';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { useChessSound } from '../contexts/ChessSoundContext';
import { useTheme } from '../contexts/ThemeContext';
import { loadActiveGame, isFinishedActiveGame } from '../lib/activeGame';
import type { ActiveGameSnapshot } from '../lib/activeGame';
import { limitPlayerNameWords } from '../lib/playerName';
import type { RootStackParamList } from '../navigation/types';
import { getShadow, radii, spacing, typography } from '../theme';
import type { AppTheme } from '../theme';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

const CONTROL_SIZE = 36;
/** splash.png is 1024×473 with the app icon centered in the frame. */
const SPLASH_ASPECT = 1024 / 473;

function MascotMark({ size, radius }: { size: number; radius: number }) {
  const imageWidth = size * SPLASH_ASPECT;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={require('../assets/splash.png')}
        style={{
          width: imageWidth,
          height: size,
          marginLeft: -(imageWidth - size) / 2,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

function mascotSizeForHeight(windowHeight: number): number {
  if (windowHeight < 700) {
    return 88;
  }
  if (windowHeight < 820) {
    return 112;
  }
  return 128;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createHomeStyles(theme), [theme]);
  const { height: windowHeight } = useWindowDimensions();
  const mascotSize = mascotSizeForHeight(windowHeight);
  const { soundEnabled, setSoundEnabled } = useChessSound();
  const { preferences, setPreference } = useAppPreferences();
  const [resumeSnapshot, setResumeSnapshot] = useState<ActiveGameSnapshot | null>(null);
  const canResumeGame = resumeSnapshot != null;
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [pieceModalVisible, setPieceModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadActiveGame().then((snapshot) => {
        if (!cancelled) {
          setResumeSnapshot(snapshot);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleResumeGame = useCallback(() => {
    void loadActiveGame().then((snapshot) => {
      if (!snapshot) {
        setResumeSnapshot(null);
        return;
      }

      if (snapshot.mode === 'bot' && snapshot.botId) {
        navigation.navigate('Board', { mode: 'bot', botId: snapshot.botId, resume: true });
        return;
      }

      navigation.navigate('Board', { mode: 'free', resume: true });
    });
  }, [navigation]);

  return (
    <View style={styles.screen}>
      <WarmRadialBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.identityCluster}>
            <PressableScale
              style={styles.nameBadge}
              pressedStyle={styles.controlPressed}
              hitSlop={6}
              onPress={() => setNameModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Change your display name"
              accessibilityHint="Shown on the board and in game review"
            >
              <Text style={styles.nameBadgeText} numberOfLines={1}>
                {preferences.playerName}
              </Text>
            </PressableScale>
            <PressableScale
              style={styles.pieceBadge}
              pressedStyle={styles.controlPressed}
              hitSlop={6}
              onPress={() => setPieceModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Change your piece icon"
            >
              <ChessPiece color="w" type={preferences.playerPieceType} size={20} />
            </PressableScale>
          </View>
          <IconButton
            variant="default"
            size="sm"
            style={styles.topSettingsButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Open settings"
          >
            <Text style={styles.topSettingsIcon}>⚙</Text>
          </IconButton>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View
              style={[styles.mascotFrame, { borderRadius: radii.xl }]}
              accessibilityRole="image"
              accessibilityLabel="ChessChomp mascot"
            >
              <MascotMark size={mascotSize} radius={radii.xl} />
            </View>
            <Text style={styles.title}>ChessChomp</Text>
            <Text style={styles.subtitle}>Play, analyze, and improve.</Text>
          </View>

          <View style={styles.actions}>
            {canResumeGame && resumeSnapshot ? (
              <PressableScale
                style={styles.resumeRow}
                pressedStyle={styles.resumeRowPressed}
                onPress={handleResumeGame}
                accessibilityRole="button"
                accessibilityLabel={
                  isFinishedActiveGame(resumeSnapshot)
                    ? 'Resume Game, Game over'
                    : 'Resume Game'
                }
              >
                <Text style={styles.resumeLabel}>
                  {isFinishedActiveGame(resumeSnapshot)
                    ? 'Resume Game (Game over)'
                    : 'Resume Game'}
                </Text>
                <Text style={styles.resumeChevron}>›</Text>
              </PressableScale>
            ) : null}

            <PressableScale
              style={styles.playCard}
              pressedStyle={styles.playCardPressed}
              onPress={() => navigation.navigate('Bots')}
              accessibilityRole="button"
              accessibilityLabel="Play vs Bots"
            >
              <View style={styles.playMascotFrame}>
                <MascotMark size={64} radius={radii.lg} />
              </View>
              <View style={styles.playCopy}>
                <Text style={styles.playTitle}>Play vs Bots</Text>
                <Text style={styles.playHint}>Pick an animal opponent</Text>
              </View>
              <Text style={styles.playChevron}>›</Text>
            </PressableScale>

            <Card padding="none" shadow="sm" style={styles.secondaryCard}>
              <SecondaryRow
                label="Free Board"
                onPress={() => navigation.navigate('Board', { mode: 'free' })}
                styles={styles}
              />
              <Divider />
              <SecondaryRow
                label="Post-Game Evaluation"
                onPress={() => navigation.navigate('GameReviewSetup')}
                styles={styles}
              />
              <Divider />
              <SecondaryRow
                label="My Games"
                onPress={() => navigation.navigate('SavedGames')}
                styles={styles}
              />
            </Card>

            <View style={styles.soundRow}>
              <Text style={styles.soundLabel}>Board sounds</Text>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
                thumbColor={soundEnabled ? theme.switchThumbOn : theme.switchThumbOff}
                accessibilityRole="switch"
                accessibilityLabel="Board sounds"
                accessibilityState={{ checked: soundEnabled }}
              />
            </View>

            <View style={styles.tertiaryRow}>
              <PressableScale
                style={styles.tertiaryButton}
                pressedStyle={styles.tertiaryPressed}
                onPress={() => navigation.navigate('Settings')}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                hitSlop={6}
              >
                <Text style={styles.tertiaryIcon}>⚙</Text>
              </PressableScale>
              <Text style={styles.tertiaryDot} accessibilityElementsHidden>
                ·
              </Text>
              <PressableScale
                style={styles.tertiaryButton}
                pressedStyle={styles.tertiaryPressed}
                onPress={() => navigation.navigate('Licenses')}
                accessibilityRole="button"
                accessibilityLabel="Licenses and attribution"
                hitSlop={6}
              >
                <Text style={styles.tertiaryText}>Licenses</Text>
              </PressableScale>
              <Text style={styles.tertiaryDot} accessibilityElementsHidden>
                ·
              </Text>
              <PressableScale
                style={styles.tertiaryButton}
                pressedStyle={styles.tertiaryPressed}
                onPress={() => navigation.navigate('BoardFeatures')}
                accessibilityRole="button"
                accessibilityLabel="Board features"
                hitSlop={6}
              >
                <Text style={styles.tertiaryText}>Board Features</Text>
              </PressableScale>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <NameGameModal
        visible={nameModalVisible}
        defaultName={preferences.playerName}
        title="Name yourself"
        placeholder="Your name"
        saveLabel="Save"
        saveAccessibilityLabel="Save display name"
        inputAccessibilityLabel="Your display name"
        maxLength={120}
        sanitizeInput={limitPlayerNameWords}
        onCancel={() => setNameModalVisible(false)}
        onSave={(name) => {
          setPreference('playerName', name);
          setNameModalVisible(false);
        }}
      />
      <PlayerPieceModal
        visible={pieceModalVisible}
        selected={preferences.playerPieceType}
        onSelect={(piece) => setPreference('playerPieceType', piece)}
        onClose={() => setPieceModalVisible(false)}
      />
    </View>
  );
}

function SecondaryRow({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createHomeStyles>;
}) {
  return (
    <PressableScale
      style={styles.secondaryRow}
      pressedStyle={styles.secondaryRowPressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
      <Text style={styles.secondaryChevron}>›</Text>
    </PressableScale>
  );
}

function createHomeStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    safeArea: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
    identityCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
    },
    nameBadge: {
      height: CONTROL_SIZE,
      maxWidth: 160,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: theme.iconButtonBorder,
      backgroundColor: theme.iconButtonBackground,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
    },
    nameBadgeText: {
      color: theme.textPrimary,
      ...typography.caption,
    },
    pieceBadge: {
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: theme.iconButtonBorder,
      backgroundColor: theme.iconButtonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlPressed: {
      backgroundColor: theme.iconButtonBackgroundPressed,
    },
    topSettingsButton: {
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
    },
    topSettingsIcon: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 18,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      gap: spacing.xl,
    },
    brand: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    mascotFrame: {
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    title: {
      color: theme.textPrimary,
      ...typography.display,
    },
    subtitle: {
      color: theme.textMuted,
      ...typography.body,
    },
    actions: {
      gap: spacing.md,
    },
    resumeRow: {
      minHeight: 44,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resumeRowPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    resumeLabel: {
      color: theme.textSecondary,
      ...typography.buttonSmall,
    },
    resumeChevron: {
      color: theme.textFaint,
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 22,
    },
    playCard: {
      minHeight: 96,
      borderRadius: radii.xl,
      borderWidth: 1.5,
      borderColor: theme.accentBorderStrong,
      backgroundColor: theme.accentSurface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      ...getShadow(theme, 'md'),
    },
    playCardPressed: {
      backgroundColor: theme.accentSurfacePressed,
    },
    playMascotFrame: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    playCopy: {
      flex: 1,
      gap: 2,
    },
    playTitle: {
      color: theme.accentSoftText,
      ...typography.subtitle,
    },
    playHint: {
      color: theme.textMuted,
      ...typography.caption,
      fontWeight: '500',
    },
    playChevron: {
      color: theme.accentText,
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 30,
    },
    secondaryCard: {
      overflow: 'hidden',
    },
    secondaryRow: {
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    secondaryRowPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    secondaryLabel: {
      color: theme.textSecondary,
      ...typography.buttonSmall,
      flexShrink: 1,
    },
    secondaryChevron: {
      color: theme.textFaint,
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 22,
      marginLeft: spacing.sm,
    },
    soundRow: {
      minHeight: 44,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...getShadow(theme, 'sm'),
    },
    soundLabel: {
      color: theme.textMuted,
      ...typography.caption,
    },
    tertiaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    tertiaryButton: {
      minHeight: 44,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tertiaryPressed: {
      opacity: 0.55,
    },
    tertiaryIcon: {
      color: theme.textFaint,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 18,
    },
    tertiaryText: {
      color: theme.textFaint,
      ...typography.caption,
      fontWeight: '600',
    },
    tertiaryDot: {
      color: theme.textFaint,
      fontSize: 16,
      lineHeight: 18,
    },
  });
}
