import type { Color } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { ChessPiece } from './chessPieces';
import MoveClassificationBadge from './MoveClassificationBadge';
import { useTheme } from '../contexts/ThemeContext';
import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import {
  buildMoveHistoryRows,
  pieceTypeFromSan,
  type MoveHistoryRow,
} from '../lib/moveHistory';
import type { AppTheme } from '../theme';

const ROW_HEIGHT = 34;
const PIECE_ICON_SIZE = 15;
const BADGE_SIZE = 14;
const MISSED_WIN_BADGE_SIZE = 12;
export const MOVE_HISTORY_ROW_HEIGHT = ROW_HEIGHT;
export const MOVE_HISTORY_LIST_HEIGHT = ROW_HEIGHT * 4.5;

type MoveHistoryListProps = {
  moves: readonly string[];
  classifiedMoves: readonly ClassifiedMoveRecord[];
  currentIndex: number;
  width: number;
  onSelectPly: (plyIndex: number) => void;
  /** Inline rows in the page ScrollView — no nested scroll box. */
  embedded?: boolean;
};

type MoveHalfCellProps = {
  plyIndex: number;
  san: string;
  pieceColor: Color;
  record: ClassifiedMoveRecord | undefined;
  isActive: boolean;
  onPress: (plyIndex: number) => void;
  styles: ReturnType<typeof createMoveHistoryListStyles>;
};

function MoveHalfCell({
  plyIndex,
  san,
  pieceColor,
  record,
  isActive,
  onPress,
  styles,
}: MoveHalfCellProps) {
  const pieceType = pieceTypeFromSan(san);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.halfMove,
        isActive && styles.halfMoveActive,
        pressed && styles.halfMovePressed,
      ]}
      onPress={() => onPress(plyIndex)}
      accessibilityRole="button"
      accessibilityLabel={`Go to move ${san}`}
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.pieceIconSlot}>
        {pieceType ? (
          <ChessPiece color={pieceColor} type={pieceType} size={PIECE_ICON_SIZE} />
        ) : null}
      </View>
      <Text
        style={[styles.moveText, isActive && styles.moveTextActive]}
        numberOfLines={1}
      >
        {san}
      </Text>
      {record ? (
        <View style={styles.badgeRow}>
          <MoveClassificationBadge classification={record.classification} size={BADGE_SIZE} />
          {record.missedWin ? (
            <MoveClassificationBadge classification="MissedWin" size={MISSED_WIN_BADGE_SIZE} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function MoveHistoryRowView({
  row,
  classifiedMoves,
  currentIndex,
  onSelectPly,
  styles,
  showDivider,
}: {
  row: MoveHistoryRow;
  classifiedMoves: readonly ClassifiedMoveRecord[];
  currentIndex: number;
  onSelectPly: (plyIndex: number) => void;
  styles: ReturnType<typeof createMoveHistoryListStyles>;
  showDivider: boolean;
}) {
  return (
    <View style={[styles.row, showDivider && styles.rowDivider]}>
      <Text style={styles.moveNumber}>{row.moveNumber}.</Text>
      <View style={styles.whiteColumn}>
        {row.white ? (
          <MoveHalfCell
            plyIndex={row.white.plyIndex}
            san={row.white.san}
            pieceColor="w"
            record={classifiedMoves[row.white.plyIndex]}
            isActive={currentIndex === row.white.plyIndex}
            onPress={onSelectPly}
            styles={styles}
          />
        ) : null}
      </View>
      <View style={styles.blackColumn}>
        {row.black ? (
          <MoveHalfCell
            plyIndex={row.black.plyIndex}
            san={row.black.san}
            pieceColor="b"
            record={classifiedMoves[row.black.plyIndex]}
            isActive={currentIndex === row.black.plyIndex}
            onPress={onSelectPly}
            styles={styles}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function MoveHistoryList({
  moves,
  classifiedMoves,
  currentIndex,
  width,
  onSelectPly,
  embedded = false,
}: MoveHistoryListProps) {
  const theme = useTheme();
  const styles = useMemo(() => createMoveHistoryListStyles(theme), [theme]);
  const listRef = useRef<FlatList<MoveHistoryRow>>(null);
  const rows = useMemo(() => buildMoveHistoryRows(moves), [moves]);

  const scrollToCurrent = useCallback(() => {
    if (embedded || rows.length === 0) {
      return;
    }

    const targetRowIndex = currentIndex >= 0 ? Math.floor(currentIndex / 2) : 0;

    listRef.current?.scrollToIndex({
      index: targetRowIndex,
      viewPosition: 0.5,
      animated: true,
    });
  }, [currentIndex, embedded, rows.length]);

  useEffect(() => {
    scrollToCurrent();
  }, [scrollToCurrent]);

  const renderRow = useCallback(
    ({ item, index }: ListRenderItemInfo<MoveHistoryRow>) => (
      <MoveHistoryRowView
        row={item}
        classifiedMoves={classifiedMoves}
        currentIndex={currentIndex}
        onSelectPly={onSelectPly}
        styles={styles}
        showDivider={index < rows.length - 1}
      />
    ),
    [classifiedMoves, currentIndex, onSelectPly, rows.length, styles],
  );

  if (rows.length === 0) {
    return null;
  }

  if (embedded) {
    return (
      <View style={[styles.container, styles.containerEmbedded, { width }]}>
        {rows.map((row, index) => (
          <MoveHistoryRowView
            key={row.white?.plyIndex ?? row.black?.plyIndex ?? index}
            row={row}
            classifiedMoves={classifiedMoves}
            currentIndex={currentIndex}
            onSelectPly={onSelectPly}
            styles={styles}
            showDivider={index < rows.length - 1}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.containerFixed, { width }]}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={rows}
        keyExtractor={(row, index) =>
          String(row.white?.plyIndex ?? row.black?.plyIndex ?? index)
        }
        renderItem={renderRow}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        showsVerticalScrollIndicator
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({
            offset: ROW_HEIGHT * index,
            animated: true,
          });
        }}
      />
    </View>
  );
}

function createMoveHistoryListStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      marginTop: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
      overflow: 'hidden',
    },
    containerFixed: {
      height: MOVE_HISTORY_LIST_HEIGHT,
    },
    containerEmbedded: {
      alignSelf: 'center',
    },
    list: {
      flex: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ROW_HEIGHT,
      paddingHorizontal: 6,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.surfaceBorder,
    },
    moveNumber: {
      width: 26,
      color: theme.textFaint,
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    whiteColumn: {
      flex: 1,
      minWidth: 0,
    },
    blackColumn: {
      flex: 1,
      minWidth: 0,
    },
    halfMove: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ROW_HEIGHT - 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      gap: 3,
    },
    halfMoveActive: {
      backgroundColor: theme.accentSurface,
      borderWidth: 1,
      borderColor: theme.accentSoftBorder,
    },
    halfMovePressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    pieceIconSlot: {
      width: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveText: {
      flexShrink: 1,
      color: theme.moveHistoryText,
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    moveTextActive: {
      color: theme.textPrimary,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    },
  });
}
