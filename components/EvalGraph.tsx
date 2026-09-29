import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '../contexts/ThemeContext';
import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import type { AppTheme } from '../theme';

type EvalGraphProps = {
  classifiedMoves: readonly ClassifiedMoveRecord[];
  currentIndex: number;
  width: number;
  onSelectPly: (plyIndex: number) => void;
};

const GRAPH_HEIGHT = 96;

function evalToRatio(evalAfter: number, color: 'w' | 'b'): number {
  const whitePerspective = color === 'w' ? evalAfter : -evalAfter;
  const clamped = Math.max(-800, Math.min(800, whitePerspective));
  return 0.5 + clamped / 1600;
}

export default function EvalGraph({
  classifiedMoves,
  currentIndex,
  width,
  onSelectPly,
}: EvalGraphProps) {
  const theme = useTheme();
  const styles = useMemo(() => createEvalGraphStyles(theme), [theme]);
  const graphColors = useMemo(() => getEvalGraphColors(theme), [theme]);

  const points = useMemo(() => {
    if (classifiedMoves.length === 0 || width <= 0) {
      return [];
    }

    const step = width / Math.max(classifiedMoves.length, 1);
    return classifiedMoves.map((record, index) => {
      const x = step * index + step / 2;
      const ratio = evalToRatio(record.evalAfter, record.color);
      const y = GRAPH_HEIGHT * (1 - ratio);
      return { x, y, index };
    });
  }, [classifiedMoves, width]);

  const whiteAreaPath = useMemo(() => {
    if (points.length === 0) {
      return '';
    }
    const first = points[0]!;
    let path = `M 0 ${GRAPH_HEIGHT} L ${first.x} ${GRAPH_HEIGHT} L ${first.x} ${first.y}`;
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      path += ` L ${point.x} ${point.y}`;
    }
    const last = points[points.length - 1]!;
    path += ` L ${last.x} ${GRAPH_HEIGHT} Z`;
    return path;
  }, [points]);

  const blackAreaPath = useMemo(() => {
    if (points.length === 0) {
      return '';
    }
    const first = points[0]!;
    let path = `M 0 0 L ${first.x} 0 L ${first.x} ${first.y}`;
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      path += ` L ${point.x} ${point.y}`;
    }
    const last = points[points.length - 1]!;
    path += ` L ${last.x} 0 Z`;
    return path;
  }, [points]);

  const markerX =
    currentIndex >= 0 && points[currentIndex] != null ? points[currentIndex]!.x : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Evaluation</Text>
      <View style={[styles.graphWrap, { width }]}>
        {classifiedMoves.length === 0 ? (
          <Text style={styles.emptyText}>Analysis will appear here.</Text>
        ) : (
          <>
            <Svg width={width} height={GRAPH_HEIGHT}>
              <Rect x={0} y={0} width={width} height={GRAPH_HEIGHT} fill={graphColors.blackFill} />
              <Path d={whiteAreaPath} fill={graphColors.whiteFill} />
              <Path d={blackAreaPath} fill={graphColors.blackFill} opacity={0.92} />
              <Line
                x1={0}
                y1={GRAPH_HEIGHT / 2}
                x2={width}
                y2={GRAPH_HEIGHT / 2}
                stroke={graphColors.midline}
                strokeWidth={1}
              />
              {markerX != null ? (
                <Line
                  x1={markerX}
                  y1={0}
                  x2={markerX}
                  y2={GRAPH_HEIGHT}
                  stroke={theme.accentBorderStrong}
                  strokeWidth={2}
                />
              ) : null}
            </Svg>
            <View style={styles.tapRow} pointerEvents="box-none">
              {points.map((point) => (
                <Pressable
                  key={point.index}
                  style={[styles.tapCell, { width: width / classifiedMoves.length }]}
                  onPress={() => onSelectPly(point.index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to move ${point.index + 1}`}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function getEvalGraphColors(theme: AppTheme) {
  const isLight = theme.scheme === 'light';

  return {
    whiteFill: isLight ? '#eeeed2' : '#d8d8bc',
    blackFill: isLight ? '#4a4a4a' : '#262421',
    midline: isLight ? 'rgba(28, 25, 22, 0.22)' : 'rgba(255, 255, 255, 0.22)',
    wrapBackground: isLight ? '#4a4a4a' : '#262421',
  };
}

function createEvalGraphStyles(theme: AppTheme) {
  const graphColors = getEvalGraphColors(theme);

  return StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.cardBackground,
      padding: 14,
      gap: 10,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    graphWrap: {
      alignSelf: 'center',
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: graphColors.wrapBackground,
      minHeight: GRAPH_HEIGHT,
      justifyContent: 'center',
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      paddingVertical: 28,
    },
    tapRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: GRAPH_HEIGHT,
      flexDirection: 'row',
    },
    tapCell: {
      height: GRAPH_HEIGHT,
    },
  });
}
