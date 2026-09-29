import type { Color, PieceSymbol, Square } from 'chess.js';
import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
} from 'react-native';

import ClassificationGlowOverlay from './ClassificationGlowOverlay';
import { ChessPiece } from './chessPieces';
import { pieceInset } from '../lib/boardGeometry';

const LIGHT_SQUARE = '#f2dcc0';
const DARK_SQUARE = '#b58863';
const LIGHT_COORD_COLOR = 'rgba(181, 136, 99, 0.6)';
const DARK_COORD_COLOR = 'rgba(242, 220, 192, 0.6)';
const SELECTED_SQUARE = 'rgba(20, 85, 30, 0.55)';
const HOVER_SQUARE = 'rgba(180, 140, 40, 0.45)';
const LEGAL_MOVE_DOT = 'rgba(0, 0, 0, 0.21)';
const LEGAL_CAPTURE_RING = 'rgba(0, 0, 0, 0.18)';

export type BoardSquareProps = {
  square: Square;
  pieceColor?: Color;
  pieceType?: PieceSymbol;
  isLight: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isLegalMove: boolean;
  isCapture: boolean;
  hidePiece: boolean;
  showPiece: boolean;
  showPendingPawn: boolean;
  pendingPawnColor?: Color;
  usePanResponder: boolean;
  panHandlers?: GestureResponderHandlers;
  onSquarePress: (square: Square) => void;
  squareSize: number;
  pieceSize: number;
  celebrationGlowColor?: string;
  celebrationGlowEffectKey?: number;
  onCelebrationComplete: () => void;
  fileLabel?: string;
  rankLabel?: string;
};

function BoardSquare({
  square,
  pieceColor,
  pieceType,
  isLight,
  isSelected,
  isHovered,
  isLegalMove,
  isCapture,
  hidePiece,
  showPiece,
  showPendingPawn,
  pendingPawnColor,
  usePanResponder,
  panHandlers,
  onSquarePress,
  squareSize,
  pieceSize,
  celebrationGlowColor,
  celebrationGlowEffectKey,
  onCelebrationComplete,
  fileLabel,
  rankLabel,
}: BoardSquareProps) {
  const backgroundColor = isSelected
    ? SELECTED_SQUARE
    : isHovered
      ? HOVER_SQUARE
      : isLight
        ? LIGHT_SQUARE
        : DARK_SQUARE;
  const coordColor = isLight ? LIGHT_COORD_COLOR : DARK_COORD_COLOR;
  const coordFontSize = Math.max(8, Math.round(squareSize * 0.175));
  const inset = pieceInset(squareSize, pieceSize);
  const pieceBoxStyle = { left: inset, top: inset, width: pieceSize, height: pieceSize };

  const content = (
    <>
      {rankLabel ? (
        <Text
          pointerEvents="none"
          style={[
            styles.rankCoord,
            { color: coordColor, fontSize: coordFontSize, lineHeight: coordFontSize + 1 },
          ]}
        >
          {rankLabel}
        </Text>
      ) : null}
      {fileLabel ? (
        <Text
          pointerEvents="none"
          style={[
            styles.fileCoord,
            { color: coordColor, fontSize: coordFontSize, lineHeight: coordFontSize + 1 },
          ]}
        >
          {fileLabel}
        </Text>
      ) : null}

      {celebrationGlowColor != null && celebrationGlowEffectKey != null ? (
        <ClassificationGlowOverlay
          key={`glow-${square}-${celebrationGlowEffectKey}`}
          color={celebrationGlowColor}
          squareSize={squareSize}
          effectKey={celebrationGlowEffectKey}
          onComplete={onCelebrationComplete}
        />
      ) : null}

      {isLegalMove && !isCapture ? <View style={styles.moveDot} /> : null}
      {isLegalMove && isCapture ? <View style={styles.captureRing} /> : null}

      {showPiece && pieceColor && pieceType ? (
        <View
          pointerEvents="none"
          style={[styles.pieceContainer, pieceBoxStyle, hidePiece && styles.draggingPieceHidden]}
        >
          <ChessPiece color={pieceColor} type={pieceType} size={pieceSize} />
        </View>
      ) : null}

      {showPendingPawn && pendingPawnColor ? (
        <View pointerEvents="none" style={[styles.pieceContainer, pieceBoxStyle]}>
          <ChessPiece color={pendingPawnColor} type="p" size={pieceSize} />
        </View>
      ) : null}
    </>
  );

  const squareStyle = [styles.square, { width: squareSize, height: squareSize, backgroundColor }];

  if (usePanResponder && panHandlers) {
    return (
      <View style={squareStyle} {...panHandlers}>
        {content}
      </View>
    );
  }

  return (
    <Pressable style={squareStyle} onPress={() => onSquarePress(square)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  square: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  rankCoord: {
    position: 'absolute',
    top: 2,
    left: 3,
    zIndex: 1,
    fontWeight: '700',
  },
  fileCoord: {
    position: 'absolute',
    bottom: 1,
    left: 3,
    zIndex: 1,
    fontWeight: '700',
  },
  moveDot: {
    position: 'absolute',
    width: '28%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: LEGAL_MOVE_DOT,
  },
  captureRing: {
    position: 'absolute',
    width: '88%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: LEGAL_CAPTURE_RING,
  },
  pieceContainer: {
    position: 'absolute',
    zIndex: 2,
  },
  draggingPieceHidden: {
    opacity: 0,
  },
});

export default memo(BoardSquare);
