import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../contexts/ThemeContext';

const CORNERS = [
  { id: 'tl', cx: '0%', cy: '0%' },
  { id: 'tr', cx: '100%', cy: '0%' },
  { id: 'bl', cx: '0%', cy: '100%' },
  { id: 'br', cx: '100%', cy: '100%' },
] as const;

export default function WarmRadialBackground() {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();

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
              stopColor={theme.radialCornerTint}
              stopOpacity={theme.radialCornerTintPeakOpacity}
            />
            <Stop
              offset="50%"
              stopColor={theme.radialCornerTintMid}
              stopOpacity={theme.radialCornerTintMidOpacity}
            />
            <Stop offset="100%" stopColor={theme.radialBase} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={theme.radialBase} />
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
