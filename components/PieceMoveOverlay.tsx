import type { Color, PieceSymbol, Square } from 'chess.js';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ChessPiece } from './chessPieces';
import { getPieceLandingOffset, getPieceLandingPosition } from '../lib/boardGeometry';
import type { BoardOrientation } from '../lib/boardOrientation';

const TAP_MOVE_MIN_MS = 100;
const TAP_MOVE_MAX_MS = 220;

const DRAG_SNAP_MIN_MS = 50;
const DRAG_SNAP_MAX_MS = 140;

function moveDurationMs(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  minMs: number,
  maxMs: number,
  msPerPx: number,
): number {
  const distance = Math.hypot(endX - startX, endY - startY);
  return Math.min(maxMs, Math.max(minMs, Math.round(distance * msPerPx)));
}

export function tapMoveDurationMs(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  return moveDurationMs(startX, startY, endX, endY, TAP_MOVE_MIN_MS, TAP_MOVE_MAX_MS, 0.5);
}

/** Lichess-style centering when releasing a drag off-center. */
export function dragSnapDurationMs(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  return moveDurationMs(startX, startY, endX, endY, DRAG_SNAP_MIN_MS, DRAG_SNAP_MAX_MS, 0.45);
}

type PieceMoveOverlayProps = {
  from: Square;
  to: Square;
  piece: { color: Color; type: PieceSymbol };
  squareSize: number;
  pieceSize: number;
  boardOrientation: BoardOrientation;
  playerColor?: Color;
  startTranslateX?: number;
  startTranslateY?: number;
  fromDrag?: boolean;
  effectKey: number;
  onComplete: (effectKey: number) => void;
};

export default function PieceMoveOverlay({
  from,
  to,
  piece,
  squareSize,
  pieceSize,
  boardOrientation,
  playerColor = 'w',
  startTranslateX = 0,
  startTranslateY = 0,
  fromDrag = false,
  effectKey,
  onComplete,
}: PieceMoveOverlayProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const fromLanding = getPieceLandingPosition(
    from,
    squareSize,
    pieceSize,
    boardOrientation,
    playerColor,
  );
  const { x: endTranslateX, y: endTranslateY } = getPieceLandingOffset(
    from,
    to,
    squareSize,
    pieceSize,
    boardOrientation,
    playerColor,
  );

  useEffect(() => {
    progress.setValue(0);
    let finishedNaturally = false;

    const notifyComplete = () => {
      onCompleteRef.current(effectKey);
    };

    const duration = fromDrag
      ? dragSnapDurationMs(startTranslateX, startTranslateY, endTranslateX, endTranslateY)
      : tapMoveDurationMs(startTranslateX, startTranslateY, endTranslateX, endTranslateY);

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) {
        finishedNaturally = true;
        notifyComplete();
      }
    });

    return () => {
      animation.stop();
      if (!finishedNaturally) {
        notifyComplete();
      }
    };
  }, [
    effectKey,
    endTranslateX,
    endTranslateY,
    from,
    fromDrag,
    progress,
    startTranslateX,
    startTranslateY,
    to,
  ]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startTranslateX, endTranslateX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startTranslateY, endTranslateY],
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
          transform: [{ translateX }, { translateY }],
          zIndex: 20,
          elevation: 20,
        }}
      >
        <ChessPiece color={piece.color} type={piece.type} size={pieceSize} />
      </Animated.View>
    </View>
  );
}
