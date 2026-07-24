import type { Color, PieceSymbol } from 'chess.js';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { CBURNETT_PIECE_SVGS, type CburnettPieceKey } from './cburnettPieceSvgs';

type ChessPieceProps = {
  color: Color;
  type: PieceSymbol;
  size: number;
};

function pieceKey(color: Color, type: PieceSymbol): CburnettPieceKey {
  return `${color}${type}` as CburnettPieceKey;
}

export function ChessPiece({ color, type, size }: ChessPieceProps) {
  const key = pieceKey(color, type);
  const xml = CBURNETT_PIECE_SVGS[key];

  if (!xml) {
    return null;
  }

  return (
    <View style={{ width: size, height: size }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
