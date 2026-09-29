import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import ActionLeadingIcon from './ActionLeadingIcon';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../theme';

type ScrollLockButtonProps = {
  locked: boolean;
  onToggle: () => void;
};

export default function ScrollLockButton({ locked, onToggle }: ScrollLockButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => createScrollLockButtonStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(locked ? 0 : 1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(rotate, {
      toValue: locked ? 0 : 1,
      speed: 28,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [locked, rotate]);

  const handlePress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 26,
          bounciness: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    onToggle();
  };

  const iconRotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-16deg'],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.85],
  });

  const iconColor = locked ? theme.textSecondary : theme.accentText;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={locked ? 'Unlock screen scrolling' : 'Lock screen scrolling'}
      accessibilityState={{ checked: !locked }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            borderColor: theme.accentBorderStrong,
            shadowColor: theme.accent,
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }, { rotate: iconRotation }] }}>
        <ActionLeadingIcon name={locked ? 'lock' : 'lockOpen'} color={iconColor} size={20} />
      </Animated.View>
    </Pressable>
  );
}

function createScrollLockButtonStyles(theme: AppTheme) {
  return StyleSheet.create({
    button: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.iconButtonBorder,
      backgroundColor: theme.iconButtonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPressed: {
      backgroundColor: theme.iconButtonBackgroundPressed,
      transform: [{ scale: 0.94 }],
    },
    glow: {
      ...StyleSheet.absoluteFill,
      borderRadius: 22,
      borderWidth: 1.5,
      shadowOpacity: 0.55,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
    },
  });
}
