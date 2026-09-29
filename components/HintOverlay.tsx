import type { Color, Square } from 'chess.js';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Marker, Polygon } from 'react-native-svg';

import { getPieceLandingPosition, getSquareCenter, pieceSizeFromSquare } from '../lib/boardGeometry';
import { squareToVisualPosition, type BoardOrientation } from '../lib/boardOrientation';

const HINT_ARROW = 'rgba(120, 200, 255, 0.85)';

type HintOverlayProps = {
  from: Square;
  to: Square;
  squareSize: number;
  boardSize: number;
  boardOrientation: BoardOrientation;
  playerColor?: Color;
  showArrow: boolean;
  /** When true, draw only the arrow (no origin square or piece highlight). */
  arrowOnly?: boolean;
};

export default function HintOverlay({
  from,
  to,
  squareSize,
  boardSize,
  boardOrientation,
  playerColor = 'w',
  showArrow,
  arrowOnly = false,
}: HintOverlayProps) {
  const pulse = useRef(new Animated.Value(arrowOnly ? 1 : 0)).current;

  useEffect(() => {
    if (arrowOnly) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [arrowOnly, from, pulse, showArrow, to]);

  const fromPos = squareToVisualPosition(from, squareSize, boardOrientation, playerColor);
  const pieceSize = pieceSizeFromSquare(squareSize);
  const piecePos = getPieceLandingPosition(from, squareSize, pieceSize, boardOrientation, playerColor);
  const fromCenter = getSquareCenter(from, squareSize, boardOrientation, playerColor);
  const toCenter = getSquareCenter(to, squareSize, boardOrientation, playerColor);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const length = Math.hypot(dx, dy) || 1;
  const startInset = squareSize * (arrowOnly ? 0.18 : 0.22);
  const endInset = squareSize * (arrowOnly ? 0.08 : 0.22);
  const lineStart = {
    x: fromCenter.x + (dx / length) * startInset,
    y: fromCenter.y + (dy / length) * startInset,
  };
  const lineEnd = {
    x: toCenter.x - (dx / length) * endInset,
    y: toCenter.y - (dy / length) * endInset,
  };
  const arrowOpacity = arrowOnly ? 1 : opacity;

  return (
    <View
      pointerEvents="none"
      style={[styles.overlay, { width: boardSize, height: boardSize }]}
    >
      {showArrow ? (
        <Animated.View style={[styles.overlay, { opacity: arrowOpacity }]}>
          <Svg width={boardSize} height={boardSize}>
            <Defs>
              <Marker
                id={arrowOnly ? 'reviewArrowhead' : 'hintArrowhead'}
                markerWidth={arrowOnly ? '10' : '8'}
                markerHeight={arrowOnly ? '10' : '8'}
                refX={arrowOnly ? '9' : '6'}
                refY={arrowOnly ? '5' : '4'}
                orient="auto"
              >
                <Polygon
                  points={arrowOnly ? '0,0 10,5 0,10' : '0,0 8,4 0,8'}
                  fill={HINT_ARROW}
                />
              </Marker>
            </Defs>
            <Line
              x1={lineStart.x}
              y1={lineStart.y}
              x2={lineEnd.x}
              y2={lineEnd.y}
              stroke={HINT_ARROW}
              strokeWidth={Math.max(4, squareSize * (arrowOnly ? 0.1 : 0.12))}
              strokeLinecap="round"
              markerEnd={`url(#${arrowOnly ? 'reviewArrowhead' : 'hintArrowhead'})`}
            />
          </Svg>
        </Animated.View>
      ) : null}

      {!arrowOnly ? (
        <>
          <Animated.View
            style={[
              styles.glow,
              {
                left: fromPos.left,
                top: fromPos.top,
                width: squareSize,
                height: squareSize,
                opacity,
              },
            ]}
          />

          <Animated.View
            style={[
              styles.pieceGlow,
              {
                left: piecePos.left,
                top: piecePos.top,
                width: pieceSize,
                height: pieceSize,
                borderRadius: pieceSize / 2,
                opacity,
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 11,
    elevation: 11,
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: 'rgba(120, 200, 255, 0.9)',
    borderRadius: 6,
    shadowColor: '#5ab0ff',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pieceGlow: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(160, 220, 255, 0.95)',
    shadowColor: '#5ab0ff',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
    elevation: 1,
  },
});
