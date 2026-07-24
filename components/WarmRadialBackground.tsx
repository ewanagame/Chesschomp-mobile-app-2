import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const BASE_BLACK = '#000000';

/** Faint dark-orange warmth confined to screen corners. */
const CORNER_TINT = '#3a1f12';
const CORNER_TINT_PEAK_OPACITY = 0.14;
const CORNER_TINT_MID = '#1a0e08';
const CORNER_TINT_MID_OPACITY = 0.05;

const CORNERS = [
  { id: 'tl', cx: '0%', cy: '0%' },
  { id: 'tr', cx: '100%', cy: '0%' },
  { id: 'bl', cx: '0%', cy: '100%' },
  { id: 'br', cx: '100%', cy: '100%' },
] as const;

export default function WarmRadialBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {CORNERS.map(({ id, cx, cy }) => (
          <RadialGradient
            key={id}
            id={`corner-${id}`}
            cx={cx}
            cy={cy}
            r="48%"
            fx={cx}
            fy={cy}
          >
            <Stop
              offset="0%"
              stopColor={CORNER_TINT}
              stopOpacity={CORNER_TINT_PEAK_OPACITY}
            />
            <Stop
              offset="50%"
              stopColor={CORNER_TINT_MID}
              stopOpacity={CORNER_TINT_MID_OPACITY}
            />
            <Stop offset="100%" stopColor={BASE_BLACK} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={BASE_BLACK} />
      {CORNERS.map(({ id }) => (
        <Rect
          key={id}
          x={0}
          y={0}
          width={width}
          height={height}
          fill={`url(#corner-${id})`}
        />
      ))}
    </Svg>
  );
}
