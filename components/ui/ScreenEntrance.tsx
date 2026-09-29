import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type ScreenEntranceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Short settle when a screen mounts: a few pixels of upward motion and a
 * fade that starts nearly opaque, so it does not flash blank over the
 * navigator transition.
 */
export default function ScreenEntrance({ children, style }: ScreenEntranceProps) {
  const opacity = useRef(new Animated.Value(0.86)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={[styles.fill, style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
