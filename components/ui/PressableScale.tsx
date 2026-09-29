import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_IN_MS = 80;
const PRESS_OUT_MS = 140;

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Applied while the finger is down, in addition to the scale. */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Scale while pressed. Defaults to a small, fast press-in. */
  pressedScale?: number;
  /** Resting scale, used for a selected state that should sit slightly forward. */
  restingScale?: number;
};

function animateScale(value: Animated.Value, toValue: number, duration: number) {
  value.stopAnimation();
  Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  }).start();
}

/**
 * Pressable that eases to about 0.97 scale on press and back to its resting
 * scale on release. Uses the built-in Animated driver so presses stay on the
 * UI thread.
 */
export default function PressableScale({
  children,
  style,
  pressedStyle,
  pressedScale = 0.97,
  restingScale = 1,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(restingScale)).current;
  const pressedRef = useRef(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!pressedRef.current) {
      animateScale(scale, restingScale, PRESS_OUT_MS);
    }
  }, [restingScale, scale]);

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressedRef.current = true;
        setPressed(true);
        if (!disabled) {
          animateScale(scale, pressedScale, PRESS_IN_MS);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressedRef.current = false;
        setPressed(false);
        animateScale(scale, restingScale, PRESS_OUT_MS);
        onPressOut?.(event);
      }}
      style={[style, pressed && !disabled ? pressedStyle : null, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
