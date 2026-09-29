import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/** Switch to `A`, `B`, or `C` to compare glow intensity on device. */
export const ACTIVE_GLOW_PRESET: GlowPresetKey = 'B';

export type GlowPresetKey = 'A' | 'B' | 'C';

export type GlowPreset = {
  /** Short label for logs / tuning notes. */
  name: string;
  /** What you'll see on device. */
  description: string;
  durationMs: number;
  /** Peak opacity of the square flash (0–1). */
  corePeakOpacity: number;
  /** Solid fill mixed under the flash. */
  coreFillAlpha: number;
  /** How far the core expands by end of animation. */
  coreEndScale: number;
  /** Peak opacity of each ripple ring (0–1). */
  ripplePeakOpacity: number;
  /** Max scale of the outermost ripple relative to square size. */
  maxRippleScale: number;
  /** SVG ring stroke width in px. */
  rippleStrokeWidth: number;
};

/**
 * Tuning presets — change ACTIVE_GLOW_PRESET above to compare.
 *
 * A Soft   — faint wash, thin ripples; closest to the original weak effect.
 * B Balanced — snappy flash + clearly visible impact ripples (recommended default).
 * C Bold   — maximum punch; strong flash and thick, wide ripples.
 */
export const GLOW_PRESETS: Record<GlowPresetKey, GlowPreset> = {
  A: {
    name: 'Soft',
    description:
      'Gentle tint on the square, thin ripples expanding ~2.4×. Easy to miss on light squares.',
    durationMs: 650,
    corePeakOpacity: 0.55,
    coreFillAlpha: 0.38,
    coreEndScale: 1.12,
    ripplePeakOpacity: 0.42,
    maxRippleScale: 2.4,
    rippleStrokeWidth: 2,
  },
  B: {
    name: 'Balanced',
    description:
      'Bright ~0.92 flash on the square, three soft radial ripples expanding ~3.2× with clear fade-out.',
    durationMs: 680,
    corePeakOpacity: 0.92,
    coreFillAlpha: 0.72,
    coreEndScale: 1.28,
    ripplePeakOpacity: 0.82,
    maxRippleScale: 3.2,
    rippleStrokeWidth: 3.5,
  },
  C: {
    name: 'Bold',
    description:
      'Near-opaque flash, heavy fill, thick ripples expanding ~4.2× — unmistakable “impact” look.',
    durationMs: 700,
    corePeakOpacity: 1,
    coreFillAlpha: 0.88,
    coreEndScale: 1.38,
    ripplePeakOpacity: 0.95,
    maxRippleScale: 4.2,
    rippleStrokeWidth: 5,
  },
};

type ClassificationGlowOverlayProps = {
  color: string;
  squareSize: number;
  effectKey: number;
  preset?: GlowPresetKey;
  onComplete?: () => void;
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

type RippleProps = {
  color: string;
  squareSize: number;
  gradientId: string;
  scale: Animated.AnimatedInterpolation<number>;
  opacity: Animated.AnimatedInterpolation<number>;
  strokeWidth: number;
};

function RadialRipple({
  color,
  squareSize,
  gradientId,
  scale,
  opacity,
  strokeWidth,
}: RippleProps) {
  const diameter = squareSize * 2.4;
  const radius = diameter / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.rippleHost,
        {
          width: diameter,
          height: diameter,
          marginLeft: -radius,
          marginTop: -radius,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <Svg width={diameter} height={diameter}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0" />
            <Stop offset="42%" stopColor={color} stopOpacity="0.55" />
            <Stop offset="68%" stopColor={color} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius * 0.94} fill={`url(#${gradientId})`} />
        <Circle
          cx={radius}
          cy={radius}
          r={radius * 0.82}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={0.75}
        />
      </Svg>
    </Animated.View>
  );
}

export default function ClassificationGlowOverlay({
  color,
  squareSize,
  effectKey,
  preset = ACTIVE_GLOW_PRESET,
  onComplete,
}: ClassificationGlowOverlayProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const presetConfig = GLOW_PRESETS[preset];

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(
        `[ClassificationGlow] preset=${preset} (${presetConfig.name}) color=${color} effectKey=${effectKey} — ${presetConfig.description}`,
      );
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: presetConfig.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });

    return () => {
      animation.stop();
    };
  }, [color, effectKey, onComplete, preset, presetConfig, progress]);

  const coreOpacity = progress.interpolate({
    inputRange: [0, 0.07, 0.28, 1],
    outputRange: [0, presetConfig.corePeakOpacity, presetConfig.corePeakOpacity * 0.55, 0],
  });
  const coreScale = progress.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0.82, 1, presetConfig.coreEndScale],
  });

  const rippleOneScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, presetConfig.maxRippleScale * 0.72],
  });
  const rippleOneOpacity = progress.interpolate({
    inputRange: [0, 0.06, 0.22, 0.58, 1],
    outputRange: [0, presetConfig.ripplePeakOpacity, presetConfig.ripplePeakOpacity * 0.65, 0.12, 0],
  });

  const rippleTwoScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, presetConfig.maxRippleScale * 0.88],
  });
  const rippleTwoOpacity = progress.interpolate({
    inputRange: [0, 0.14, 0.32, 0.72, 1],
    outputRange: [0, 0, presetConfig.ripplePeakOpacity * 0.92, presetConfig.ripplePeakOpacity * 0.35, 0],
  });

  const rippleThreeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, presetConfig.maxRippleScale],
  });
  const rippleThreeOpacity = progress.interpolate({
    inputRange: [0, 0.24, 0.42, 0.82, 1],
    outputRange: [0, 0, presetConfig.ripplePeakOpacity * 0.78, presetConfig.ripplePeakOpacity * 0.22, 0],
  });

  const gradientPrefix = `celebration-glow-${effectKey}`;

  return (
    <View pointerEvents="none" style={styles.host}>
      <RadialRipple
        color={color}
        squareSize={squareSize}
        gradientId={`${gradientPrefix}-3`}
        scale={rippleThreeScale}
        opacity={rippleThreeOpacity}
        strokeWidth={presetConfig.rippleStrokeWidth}
      />
      <RadialRipple
        color={color}
        squareSize={squareSize}
        gradientId={`${gradientPrefix}-2`}
        scale={rippleTwoScale}
        opacity={rippleTwoOpacity}
        strokeWidth={presetConfig.rippleStrokeWidth}
      />
      <RadialRipple
        color={color}
        squareSize={squareSize}
        gradientId={`${gradientPrefix}-1`}
        scale={rippleOneScale}
        opacity={rippleOneOpacity}
        strokeWidth={presetConfig.rippleStrokeWidth}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.coreGlow,
          {
            backgroundColor: hexToRgba(color, presetConfig.coreFillAlpha),
            borderColor: hexToRgba(color, Math.min(1, presetConfig.corePeakOpacity)),
            opacity: coreOpacity,
            transform: [{ scale: coreScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  coreGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 4,
    borderWidth: 2.5,
  },
  rippleHost: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
