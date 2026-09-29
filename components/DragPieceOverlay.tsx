import type { Color, PieceSymbol, Square } from 'chess.js';
import { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ChessPiece } from './chessPieces';
import { getPieceLandingPosition } from '../lib/boardGeometry';
import type { BoardOrientation } from '../lib/boardOrientation';

type DragPieceOverlayProps = {
  from: Square;
  piece: { color: Color; type: PieceSymbol };
  squareSize: number;
  pieceSize: number;
  boardOrientation: BoardOrientation;
  playerColor?: Color;
  translateX: Animated.Value;
  translateY: Animated.Value;
};

function DragPieceOverlay({
  from,
  piece,
  squareSize,
  pieceSize,
  boardOrientation,
  playerColor = 'w',
  translateX,
  translateY,
}: DragPieceOverlayProps) {
  const landing = getPieceLandingPosition(
    from,
    squareSize,
    pieceSize,
    boardOrientation,
    playerColor,
  );

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View
        style={{
          position: 'absolute',
          left: landing.left,
          top: landing.top,
          width: pieceSize,
          height: pieceSize,
          transform: [{ translateX }, { translateY }],
        }}
      >
        <ChessPiece color={piece.color} type={piece.type} size={pieceSize} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
});

export default memo(DragPieceOverlay);
