import { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

type DragSliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (next: number) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 6;
const HOST_PADDING_VERTICAL = 14;
const HIT_AREA_HEIGHT = 32;

/** Vertical offset from the top of DragSlider host to the track bar. */
export const SLIDER_TRACK_TOP = HOST_PADDING_VERTICAL + (HIT_AREA_HEIGHT - TRACK_HEIGHT) / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  return clamp(snapped, min, max);
}

function ratioForValue(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return (value - min) / (max - min);
}

export default function DragSlider({
  value,
  min,
  max,
  step,
  onValueChange,
  style,
  accessibilityLabel,
}: DragSliderProps) {
  const theme = useTheme();
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setValueFromX = useCallback(
    (locationX: number) => {
      const width = trackWidthRef.current;
      if (width <= 0) {
        return;
      }

      const usable = Math.max(1, width - THUMB_SIZE);
      const clampedX = clamp(locationX - THUMB_SIZE / 2, 0, usable);
      const ratio = clampedX / usable;
      const raw = min + ratio * (max - min);
      onValueChange(snapToStep(raw, min, max, step));
    },
    [max, min, onValueChange, step],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setValueFromX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          setValueFromX(event.nativeEvent.locationX);
        },
      }),
    [setValueFromX],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }, []);

  const fillRatio = ratioForValue(value, min, max);
  const thumbLeft = fillRatio * Math.max(0, trackWidth - THUMB_SIZE);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          width: '100%',
          paddingVertical: 14,
        },
        trackHitArea: {
          height: 32,
          justifyContent: 'center',
        },
        track: {
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: theme.sliderTrack,
          overflow: 'hidden',
        },
        trackFill: {
          height: '100%',
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: theme.sliderFill,
        },
        thumb: {
          position: 'absolute',
          top: (32 - THUMB_SIZE) / 2,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: theme.sliderThumb,
          borderWidth: 2,
          borderColor: theme.sliderThumbBorder,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 3,
          elevation: 3,
        },
      }),
    [theme],
  );

  return (
    <View
      style={[styles.host, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
    >
      <View style={styles.trackHitArea} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${fillRatio * 100}%` }]} />
        </View>
        <View
          style={[
            styles.thumb,
            {
              left: thumbLeft,
            },
          ]}
        />
      </View>
    </View>
  );
}
