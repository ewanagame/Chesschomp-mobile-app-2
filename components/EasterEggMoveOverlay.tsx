import type { Color, PieceSymbol, Square } from 'chess.js';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ChessPiece } from './chessPieces';
import { getPieceLandingOffset, getPieceLandingPosition } from '../lib/boardGeometry';
import type { BoardOrientation } from '../lib/boardOrientation';

export const EASTER_EGG_PAUSE_MS = 50;
export const EASTER_EGG_ANIMATION_MS = 380;
/** Zoom-in beat at origin before the piece starts traveling (matches overlay interpolations). */
export const EASTER_EGG_TRAVEL_START = 0.28;
/** Peak scale during the origin zoom-in beat. */
export const EASTER_EGG_PEAK_SCALE = 2;

type EasterEggMoveOverlayProps = {
  from: Square;
  to: Square;
  piece: { color: Color; type: PieceSymbol };
  squareSize: number;
  pieceSize: number;
  boardOrientation: BoardOrientation;
  playerColor?: Color;
  effectKey: number;
  onComplete: () => void;
};

export default function EasterEggMoveOverlay({
  from,
  to,
  piece,
  squareSize,
  pieceSize,
  boardOrientation,
  playerColor = 'w',
  effectKey,
  onComplete,
}: EasterEggMoveOverlayProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const fromLanding = getPieceLandingPosition(
    from,
    squareSize,
    pieceSize,
    boardOrientation,
    playerColor,
  );
  const { x: offsetX, y: offsetY } = getPieceLandingOffset(
    from,
    to,
    squareSize,
    pieceSize,
    boardOrientation,
    playerColor,
  );

  useEffect(() => {
    progress.setValue(0);
    let animation: Animated.CompositeAnimation | null = null;

    const pauseId = setTimeout(() => {
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: EASTER_EGG_ANIMATION_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      });

      animation.start(({ finished }) => {
        if (finished) {
          onComplete();
        }
      });
    }, EASTER_EGG_PAUSE_MS);

    return () => {
      clearTimeout(pauseId);
      animation?.stop();
    };
  }, [effectKey, onComplete, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, EASTER_EGG_TRAVEL_START, 1],
    outputRange: [0, 0, offsetX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, EASTER_EGG_TRAVEL_START, 1],
    outputRange: [0, 0, offsetY],
  });
  const rotate = progress.interpolate({
    inputRange: [0, EASTER_EGG_TRAVEL_START, 1],
    outputRange: ['0deg', '0deg', '360deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.18, EASTER_EGG_TRAVEL_START, 0.62, 1],
    outputRange: [1, EASTER_EGG_PEAK_SCALE, EASTER_EGG_PEAK_SCALE, 1.12, 1],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          left: fromLanding.left,
          top: fromLanding.top,
          width: pieceSize,
          height: pieceSize,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
        }}
      >
        <ChessPiece color={piece.color} type={piece.type} size={pieceSize} />
      </Animated.View>
    </View>
  );
}
