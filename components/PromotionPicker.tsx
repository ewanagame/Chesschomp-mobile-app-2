import type { Color, PieceSymbol } from 'chess.js';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChessPiece } from './chessPieces';

const PROMOTION_PIECES: PieceSymbol[] = ['q', 'r', 'n', 'b'];

type PromotionPickerProps = {
  color: Color;
  squareSize: number;
  left: number;
  top: number;
  onSelect: (piece: PieceSymbol) => void;
};

export default function PromotionPicker({
  color,
  squareSize,
  left,
  top,
  onSelect,
}: PromotionPickerProps) {
  const pieceSize = squareSize * 0.88;

  return (
    <View
      style={[
        styles.picker,
        {
          left,
          top,
          width: squareSize,
          height: squareSize * PROMOTION_PIECES.length,
        },
      ]}
    >
      {PROMOTION_PIECES.map((type) => (
        <Pressable
          key={type}
          style={[styles.option, { width: squareSize, height: squareSize }]}
          onPress={() => onSelect(type)}
        >
          <ChessPiece color={color} type={type} size={pieceSize} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: '#5a4633',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});
