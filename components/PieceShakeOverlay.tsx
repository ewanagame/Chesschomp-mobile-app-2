import type { Color, PieceSymbol, Square } from 'chess.js';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ChessPiece } from './chessPieces';
import { getPieceLandingOffset, getPieceLandingPosition } from '../lib/boardGeometry';
import type { BoardOrientation } from '../lib/boardOrientation';

export const PIECE_SHAKE_MS = 220;

const SHAKE_OFFSET = 6;

type PieceShakeOverlayProps = {
  square: Square;
  piece: { color: Color; type: PieceSymbol };
  squareSize: number;
  pieceSize: number;
  boardOrientation: BoardOrientation;
  playerColor?: Color;
  effectKey: number;
  onComplete: () => void;
};

export default function PieceShakeOverlay({
  square,
  piece,
  squareSize,
  pieceSize,
  boardOrientation,
  playerColor = 'w',
  effectKey,
  onComplete,
}: PieceShakeOverlayProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const landing = getPieceLandingPosition(
    square,
    squareSize,
    pieceSize,
    boardOrientation,
    playerColor,
  );

  useEffect(() => {
    translateX.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(translateX, {
        toValue: SHAKE_OFFSET,
        duration: 45,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: -SHAKE_OFFSET,
        duration: 45,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: SHAKE_OFFSET * 0.65,
        duration: 40,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: -SHAKE_OFFSET * 0.65,
        duration: 40,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 50,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });

    return () => {
      animation.stop();
    };
  }, [effectKey, onComplete, translateX]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          left: landing.left,
          top: landing.top,
          width: pieceSize,
          height: pieceSize,
          transform: [{ translateX }],
          zIndex: 20,
          elevation: 20,
        }}
      >
        <ChessPiece color={piece.color} type={piece.type} size={pieceSize} />
      </Animated.View>
    </View>
  );
}
