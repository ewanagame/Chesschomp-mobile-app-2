import type { Color, PieceSymbol } from 'chess.js';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import AppImage from './AppImage';
import { ChessPiece } from './chessPieces';
import { useTheme } from '../contexts/ThemeContext';
import {
  BOARD_SIDE_AVATAR_GAP,
  BOARD_SIDE_AVATAR_SIZE,
  CAPTURE_ROW_HEIGHT,
  CAPTURED_PIECES_BAR_HEIGHT,
  capturedPiecesBarWidth,
  expandCapturedPieceIcons,
  type SideCaptures,
} from '../lib/capturedPieces';
import type { AppTheme } from '../theme';

type CapturedPiecesBarProps = {
  captures: SideCaptures;
  captorColor: Color;
  /** When set, this side leads in captured material — show "+N" on this bar only. */
  advantagePoints: number | null;
  width: number;
  pieceIconSize: number;
  portraitSource: ImageSourcePropType;
  portraitLabel: string;
};

export default function CapturedPiecesBar({
  captures,
  captorColor,
  advantagePoints,
  width,
  pieceIconSize,
  portraitSource,
  portraitLabel,
}: CapturedPiecesBarProps) {
  const theme = useTheme();
  const styles = useMemo(() => createCapturedPiecesBarStyles(theme), [theme]);
  const displayColor = captorColor === 'w' ? 'b' : 'w';
  const icons = expandCapturedPieceIcons(captures.counts);
  const iconOverlap = Math.round(pieceIconSize * 0.38);
  const groupGap = Math.max(2, Math.round(pieceIconSize * 0.12));
  const barWidth = capturedPiecesBarWidth(width);
  const accessibilityLabel =
    advantagePoints != null && advantagePoints > 0
      ? `${portraitLabel}, plus ${advantagePoints} material`
      : portraitLabel;

  return (
    <View style={[styles.row, { width, height: CAPTURE_ROW_HEIGHT }]}>
      <AppImage
        source={portraitSource}
        style={styles.portrait}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel={portraitLabel}
      />

      <View
        style={[styles.bar, { width: barWidth, height: CAPTURED_PIECES_BAR_HEIGHT }]}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.iconsRow}>
          {icons.map((type, index) => {
            const previousType: PieceSymbol | null = index > 0 ? icons[index - 1]! : null;
            const marginLeft =
              index === 0 ? 0 : previousType === type ? -iconOverlap : groupGap;

            return (
              <View
                key={`${type}-${index}`}
                style={[styles.pieceIcon, { marginLeft, zIndex: index + 1 }]}
              >
                <ChessPiece color={displayColor} type={type} size={pieceIconSize} />
              </View>
            );
          })}
        </View>

        <View style={styles.labelColumn}>
          <Text style={styles.labelText} numberOfLines={1}>
            {portraitLabel}
          </Text>
          {advantagePoints != null && advantagePoints > 0 ? (
            <Text style={styles.advantageLabel}>+{advantagePoints}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function createCapturedPiecesBarStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: BOARD_SIDE_AVATAR_GAP,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 8,
      paddingRight: 10,
      backgroundColor: theme.capturedBarBackground,
      borderRadius: 10,
      overflow: 'hidden',
    },
    iconsRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      minWidth: 0,
      minHeight: CAPTURED_PIECES_BAR_HEIGHT,
    },
    pieceIcon: {
      flexShrink: 0,
    },
    labelColumn: {
      flexShrink: 0,
      maxWidth: '42%',
      paddingLeft: 8,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    portrait: {
      width: BOARD_SIDE_AVATAR_SIZE,
      height: BOARD_SIDE_AVATAR_SIZE,
      borderRadius: BOARD_SIDE_AVATAR_SIZE / 2,
      backgroundColor: theme.capturedBarBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.cardBorder,
      flexShrink: 0,
    },
    labelText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      maxWidth: '100%',
    },
    advantageLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
