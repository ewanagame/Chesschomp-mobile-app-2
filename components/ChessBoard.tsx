import { Chess, DEFAULT_POSITION, Move, Square } from 'chess.js';
import type { Color, PieceSymbol } from 'chess.js';
import { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ChessPiece } from './chessPieces';
import EvalBar from './EvalBar';
import MoveClassificationBadge from './MoveClassificationBadge';
import PromotionPicker from './PromotionPicker';
import { useMoveClassification } from '../hooks/useMoveClassification';

const FILES: readonly string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const BOARD_MARGIN = 0;
const NOTATION_GUTTER = 2;
/** Original layout inset before size increases (16×2 + 18). */
const ORIGINAL_BOARD_INSET = 50;
const BOARD_SIZE_SCALE = 1.2;
const LIGHT_SQUARE = '#f2dcc0';
const DARK_SQUARE = '#b58863';
const SELECTED_SQUARE = 'rgba(20, 85, 30, 0.55)';
const LEGAL_MOVE_DOT = 'rgba(0, 0, 0, 0.21)';
const LEGAL_CAPTURE_RING = 'rgba(0, 0, 0, 0.18)';

type BoardLayout = {
  x: number;
  y: number;
  size: number;
};

type DragState = {
  from: Square;
  pageX: number;
  pageY: number;
};

type PendingPromotion = {
  from: Square;
  to: Square;
  color: Color;
};

type InteractionHandlers = {
  gameOver: boolean;
  turn: 'w' | 'b';
  pieceSize: number;
  selectSquare: (square: Square) => void;
  finishDrag: (from: Square, pageX: number, pageY: number) => void;
  canMoveFrom: (square: Square) => boolean;
};

function toSquare(fileIndex: number, rankIndex: number): Square {
  return `${FILES[fileIndex]}${8 - rankIndex}` as Square;
}

function squareFromPageCoords(pageX: number, pageY: number, layout: BoardLayout): Square | null {
  const relX = pageX - layout.x;
  const relY = pageY - layout.y;

  if (relX < 0 || relY < 0 || relX >= layout.size || relY >= layout.size) {
    return null;
  }

  const squareSize = layout.size / 8;
  const fileIndex = Math.min(7, Math.floor(relX / squareSize));
  const rankIndex = Math.min(7, Math.floor(relY / squareSize));

  return toSquare(fileIndex, rankIndex);
}

function squareToPosition(square: Square, squareSize: number): { left: number; top: number; rankIndex: number; fileIndex: number } {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = 8 - parseInt(square[1], 10);
  return {
    fileIndex,
    rankIndex,
    left: fileIndex * squareSize,
    top: rankIndex * squareSize,
  };
}

function promotionPickerPosition(to: Square, squareSize: number, color: Color) {
  const { left, top } = squareToPosition(to, squareSize);

  // Stack toward the center of the board so the picker stays on-screen (WintrChess-style column).
  const pickerTop = color === 'w' ? top : top - squareSize * 3;

  return { left, top: pickerTop };
}

export default function ChessBoard() {
  const { width: windowWidth } = useWindowDimensions();
  const maxBoardSize = windowWidth - BOARD_MARGIN * 2 - NOTATION_GUTTER;
  const targetBoardSize = (windowWidth - ORIGINAL_BOARD_INSET) * BOARD_SIZE_SCALE;
  const boardSize = Math.min(maxBoardSize, targetBoardSize);
  const squareSize = boardSize / 8;
  const pieceSize = squareSize * 0.92;

  const gameRef = useRef(new Chess(DEFAULT_POSITION));
  const boardLayoutRef = useRef<BoardLayout>({ x: 0, y: 0, size: boardSize });
  const wrapperOffsetRef = useRef({ x: 0, y: 0 });
  const boardRef = useRef<View>(null);
  const wrapperRef = useRef<View>(null);
  const interactionHandlersRef = useRef<InteractionHandlers>({
    gameOver: false,
    turn: 'w',
    pieceSize,
    selectSquare: () => undefined,
    finishDrag: () => undefined,
    canMoveFrom: () => false,
  });
  const panRespondersRef = useRef<Partial<Record<Square, ReturnType<typeof PanResponder.create>>>>({});
  const suppressPressRef = useRef(false);
  const movedDuringPanRef = useRef(false);
  const lastDragPageRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const [boardVersion, setBoardVersion] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  dragStateRef.current = dragState;

  const { onMovePlayed, resetClassification, latestClassification, positionEval } =
    useMoveClassification();

  const game = gameRef.current;
  const board = game.board();
  const gameOver = game.isGameOver();
  const turn = game.turn();

  const legalMoves: Move[] =
    !selectedSquare || gameOver || pendingPromotion
      ? []
      : game.moves({ square: selectedSquare, verbose: true });

  const legalMoveSquares = new Set(legalMoves.map((move) => move.to));
  const captureSquares = new Set(
    legalMoves.filter((move) => move.isCapture()).map((move) => move.to),
  );

  const refreshBoard = useCallback(() => {
    setBoardVersion((version) => version + 1);
  }, []);

  const resetGame = useCallback(() => {
    gameRef.current.reset();
    panRespondersRef.current = {};
    setSelectedSquare(null);
    setDragState(null);
    setPendingPromotion(null);
    resetClassification();
    refreshBoard();
  }, [refreshBoard, resetClassification]);

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, width) => {
      boardLayoutRef.current = { x, y, size: width };
    });
    wrapperRef.current?.measureInWindow((x, y) => {
      wrapperOffsetRef.current = { x, y };
    });
  }, []);

  const canMoveFrom = useCallback(
    (square: Square) => !gameOver && !pendingPromotion && game.get(square)?.color === turn,
    [game, gameOver, pendingPromotion, turn],
  );

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
  }, []);

  const selectSquare = useCallback(
    (square: Square) => {
      const piece = game.get(square);
      if (!piece || piece.color !== turn || gameOver) {
        clearSelection();
        return;
      }
      setSelectedSquare(square);
    },
    [clearSelection, game, gameOver, turn],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    clearSelection();
    setDragState(null);
  }, [clearSelection]);

  const completePromotion = useCallback(
    (promotion: PieceSymbol) => {
      if (!pendingPromotion) {
        return;
      }

      const fenBefore = game.fen();
      const result = game.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion,
      });

      setPendingPromotion(null);
      clearSelection();
      setDragState(null);
      refreshBoard();

      if (result) {
        onMovePlayed(result, fenBefore);
      }
    },
    [clearSelection, game, onMovePlayed, pendingPromotion, refreshBoard],
  );

  const tryMove = useCallback(
    (from: Square, to: Square) => {
      const moves = game.moves({ square: from, verbose: true });
      const move = moves.find((candidate) => candidate.to === to);

      if (!move) {
        return false;
      }

      if (move.isPromotion()) {
        setPendingPromotion({ from, to, color: game.turn() });
        clearSelection();
        setDragState(null);
        return true;
      }

      const fenBefore = game.fen();
      const result = game.move({ from, to });
      clearSelection();
      setDragState(null);
      refreshBoard();

      if (result) {
        onMovePlayed(result, fenBefore);
      }
      return true;
    },
    [clearSelection, game, onMovePlayed, refreshBoard],
  );

  const handleSquarePress = useCallback(
    (square: Square) => {
      if (dragStateRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix-v2',hypothesisId:'H-E',location:'ChessBoard.tsx:handleSquarePress',message:'square press blocked during drag',data:{square},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }
      if (suppressPressRef.current) {
        suppressPressRef.current = false;
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H-E',location:'ChessBoard.tsx:handleSquarePress',message:'square press suppressed after drag',data:{square},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H-E',location:'ChessBoard.tsx:handleSquarePress',message:'square press',data:{square,selectedSquare,hasDragState:!!dragState},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (gameOver || pendingPromotion) {
        return;
      }

      if (selectedSquare) {
        if (selectedSquare === square) {
          clearSelection();
          return;
        }

        if (tryMove(selectedSquare, square)) {
          return;
        }
      }

      selectSquare(square);
    },
    [clearSelection, gameOver, pendingPromotion, selectSquare, selectedSquare, tryMove, dragState],
  );

  const finishDrag = useCallback(
    (from: Square, pageX: number, pageY: number) => {
      boardRef.current?.measureInWindow((x, y, width) => {
        const layout = { x, y, size: width };
        boardLayoutRef.current = layout;
        const targetSquare = squareFromPageCoords(pageX, pageY, layout);

        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H-D',location:'ChessBoard.tsx:finishDrag',message:'finish drag',data:{from,pageX,pageY,boardX:x,boardY:y,boardSize:width,targetSquare,moveWillAttempt:!!targetSquare},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        setDragState(null);

        if (targetSquare) {
          const moved = tryMove(from, targetSquare);
          // #region agent log
          fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H-D',location:'ChessBoard.tsx:finishDrag:result',message:'tryMove result',data:{from,targetSquare,moved},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (!moved) {
            clearSelection();
          }
        } else {
          clearSelection();
        }
      });
    },
    [clearSelection, tryMove],
  );

  const completePanEnd = useCallback(
    (from: Square, dropPageX: number, dropPageY: number, movedEnough: boolean, endType: 'release' | 'terminate') => {
      boardRef.current?.measureInWindow((x, y, width) => {
        const layout = { x, y, size: width };
        boardLayoutRef.current = layout;
        const dropSquare = squareFromPageCoords(dropPageX, dropPageY, layout);
        const didDrag = movedEnough || (dropSquare !== null && dropSquare !== from);

        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix-v2',hypothesisId:'H-B',location:'ChessBoard.tsx:completePanEnd',message:`pan ${endType}`,data:{from,dropPageX,dropPageY,dropSquare,movedEnough,didDrag},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        movedDuringPanRef.current = false;
        lastDragPageRef.current = null;

        if (didDrag) {
          suppressPressRef.current = true;
          interactionHandlersRef.current.finishDrag(from, dropPageX, dropPageY);
        } else {
          setDragState(null);
        }
      });
    },
    [],
  );

  interactionHandlersRef.current = {
    gameOver,
    turn,
    pieceSize,
    selectSquare,
    finishDrag,
    canMoveFrom,
  };

  const getPiecePanResponder = (square: Square) => {
    if (!panRespondersRef.current[square]) {
      panRespondersRef.current[square] = PanResponder.create({
        onStartShouldSetPanResponder: () => interactionHandlersRef.current.canMoveFrom(square),
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          movedDuringPanRef.current = false;
          lastDragPageRef.current = null;
          measureBoard();
          wrapperRef.current?.measureInWindow((x, y) => {
            wrapperOffsetRef.current = { x, y };
            // #region agent log
            fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H-A',location:'ChessBoard.tsx:grant',message:'wrapper measured on grant',data:{square,offsetX:x,offsetY:y},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          });
          boardRef.current?.measureInWindow((x, y, width) => {
            boardLayoutRef.current = { x, y, size: width };
          });
          interactionHandlersRef.current.selectSquare(square);
        },
        onPanResponderMove: (event, gesture) => {
          const pageX = event.nativeEvent.pageX;
          const pageY = event.nativeEvent.pageY;
          lastDragPageRef.current = { pageX, pageY };

          if (Math.abs(gesture.dx) <= 2 && Math.abs(gesture.dy) <= 2) {
            return;
          }

          movedDuringPanRef.current = true;
          setDragState({
            from: square,
            pageX,
            pageY,
          });
        },
        onPanResponderRelease: (event, gesture) => {
          const movedEnough =
            movedDuringPanRef.current ||
            Math.abs(gesture.dx) > 2 ||
            Math.abs(gesture.dy) > 2;
          const dropPageX = lastDragPageRef.current?.pageX ?? event.nativeEvent.pageX;
          const dropPageY = lastDragPageRef.current?.pageY ?? event.nativeEvent.pageY;
          completePanEnd(square, dropPageX, dropPageY, movedEnough, 'release');
        },
        onPanResponderTerminate: (event, gesture) => {
          const movedEnough =
            movedDuringPanRef.current ||
            Math.abs(gesture.dx) > 2 ||
            Math.abs(gesture.dy) > 2;
          const dropPageX = lastDragPageRef.current?.pageX ?? event.nativeEvent.pageX;
          const dropPageY = lastDragPageRef.current?.pageY ?? event.nativeEvent.pageY;
          completePanEnd(square, dropPageX, dropPageY, movedEnough, 'terminate');
        },
      });
    }

    return panRespondersRef.current[square]!;
  };

  const draggedPiece = dragState ? game.get(dragState.from) : null;
  const dragLeft = dragState
    ? dragState.pageX - wrapperOffsetRef.current.x - pieceSize / 2
    : 0;
  const dragTop = dragState
    ? dragState.pageY - wrapperOffsetRef.current.y - pieceSize / 2
    : 0;

  const pickerPosition = pendingPromotion
    ? promotionPickerPosition(pendingPromotion.to, squareSize, pendingPromotion.color)
    : null;

  const classificationBadgeSize = Math.max(18, squareSize * 0.28);
  const classificationBadgePosition = latestClassification
    ? squareToPosition(latestClassification.square, squareSize)
    : null;

  return (
    <View style={styles.screen}>
      <View ref={wrapperRef} style={styles.wrapper} onLayout={measureBoard}>
      <View style={styles.boardRow}>
        <EvalBar height={boardSize + 2} eval={positionEval} />
        <View style={styles.boardColumn}>
          <View
            style={[
              styles.boardBorder,
              { width: boardSize + 2, height: boardSize + 2 },
            ]}
          >
            <View
              ref={boardRef}
              style={[styles.board, { width: boardSize, height: boardSize }]}
              onLayout={measureBoard}
            >
              {board.map((row, rankIndex) =>
                row.map((cell, fileIndex) => {
                  const square = toSquare(fileIndex, rankIndex);
                  const isLight = (rankIndex + fileIndex) % 2 === 0;
                  const isSelected = selectedSquare === square;
                  const isLegalMove = legalMoveSquares.has(square);
                  const isCapture = captureSquares.has(square);
                  const piece = cell;
                  const isDraggingFromSquare = dragState?.from === square;
                  const isPendingFrom = pendingPromotion?.from === square;
                  const isPendingTo = pendingPromotion?.to === square;
                  const canDrag = canMoveFrom(square);
                  const showPiece = piece && !isPendingFrom;
                  const isDraggablePieceSquare = !!(canDrag && piece);
                  const squareStyle = [
                    styles.square,
                    {
                      width: squareSize,
                      height: squareSize,
                      backgroundColor: isSelected
                        ? SELECTED_SQUARE
                        : isLight
                          ? LIGHT_SQUARE
                          : DARK_SQUARE,
                    },
                  ];
                  const squareContent = (
                    <>
                      {isLegalMove && !isCapture && <View style={styles.moveDot} />}
                      {isLegalMove && isCapture && <View style={styles.captureRing} />}

                      {showPiece && (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.pieceContainer,
                            isDraggingFromSquare && styles.draggingPieceHidden,
                          ]}
                        >
                          <ChessPiece color={piece.color} type={piece.type} size={pieceSize} />
                        </View>
                      )}

                      {isPendingTo && pendingPromotion && (
                        <View pointerEvents="none" style={styles.pieceContainer}>
                          <ChessPiece color={pendingPromotion.color} type="p" size={pieceSize} />
                        </View>
                      )}
                    </>
                  );

                  if (isDraggablePieceSquare) {
                    return (
                      <View
                        key={square}
                        style={squareStyle}
                        {...getPiecePanResponder(square).panHandlers}
                      >
                        {squareContent}
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={square}
                      style={squareStyle}
                      onPress={() => handleSquarePress(square)}
                    >
                      {squareContent}
                    </Pressable>
                  );
                }),
              )}

              {pendingPromotion && pickerPosition && (
                <>
                  <Pressable style={styles.promotionBackdrop} onPress={cancelPromotion} />
                  <PromotionPicker
                    color={pendingPromotion.color}
                    squareSize={squareSize}
                    left={pickerPosition.left}
                    top={pickerPosition.top}
                    onSelect={completePromotion}
                  />
                </>
              )}

              {latestClassification && classificationBadgePosition && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.classificationBadgeHost,
                    {
                      left:
                        classificationBadgePosition.left +
                        squareSize -
                        classificationBadgeSize * 0.55,
                      top: classificationBadgePosition.top + squareSize * 0.02,
                      width: classificationBadgeSize,
                      height: classificationBadgeSize,
                    },
                  ]}
                >
                  <MoveClassificationBadge
                    classification={latestClassification.classification}
                    size={classificationBadgeSize}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={[styles.fileNotationRow, { width: boardSize }]}>
            {FILES.map((file) => (
              <Text key={file} style={[styles.fileNotation, { width: squareSize }]}>
                {file}
              </Text>
            ))}
          </View>
        </View>

        <View style={[styles.rankNotationColumn, { width: NOTATION_GUTTER, height: boardSize }]}>
          {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => (
            <Text key={rank} style={[styles.rankNotation, { height: squareSize, lineHeight: squareSize }]}>
              {rank}
            </Text>
          ))}
        </View>
      </View>

      {dragState && draggedPiece && (
        <View pointerEvents="none" style={styles.dragOverlay}>
          <View
            style={{
              position: 'absolute',
              left: dragLeft,
              top: dragTop,
              width: pieceSize,
              height: pieceSize,
            }}
          >
            <ChessPiece color={draggedPiece.color} type={draggedPiece.type} size={pieceSize} />
          </View>
        </View>
      )}
      </View>

      <SafeAreaView style={styles.resetAnchor} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
          onPress={resetGame}
          accessibilityRole="button"
          accessibilityLabel="Reset game"
        >
          <Text style={styles.resetButtonText}>↺ Reset</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BOARD_MARGIN,
    position: 'relative',
  },
  boardBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
  },
  classificationBadgeHost: {
    position: 'absolute',
    zIndex: 12,
    elevation: 12,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  boardColumn: {
    alignItems: 'center',
  },
  rankNotationColumn: {
    justifyContent: 'flex-start',
  },
  rankNotation: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
  },
  fileNotationRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  fileNotation: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
  },
  square: {
    alignItems: 'center',
    justifyContent: 'center',
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
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draggingPieceHidden: {
    opacity: 0,
  },
  hiddenPiece: {
    opacity: 0,
  },
  promotionBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
    elevation: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  dragOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    elevation: 10,
  },
  resetAnchor: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingLeft: 5,
    paddingBottom: 5,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  resetButtonText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 16,
    fontWeight: '600',
  },
});
