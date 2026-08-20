import { Chess, DEFAULT_POSITION, Move, Square } from 'chess.js';
import type { Color, PieceSymbol } from 'chess.js';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ChessPiece } from './chessPieces';
import CapturedPiecesBar from './CapturedPiecesBar';
import AccuracyReport from './AccuracyReport';
import CheckmateOverlay from './CheckmateOverlay';
import ClassificationGlowOverlay from './ClassificationGlowOverlay';
import DragPieceOverlay from './DragPieceOverlay';
import EasterEggMoveOverlay from './EasterEggMoveOverlay';
import EvalBar from './EvalBar';
import PieceMoveOverlay from './PieceMoveOverlay';
import PieceShakeOverlay from './PieceShakeOverlay';
import HintOverlay from './HintOverlay';
import MoveClassificationBadge, {
  CLASSIFICATION_BADGE_STYLES,
} from './MoveClassificationBadge';
import PromotionPicker from './PromotionPicker';
import { useMoveClassification, type ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { useCheckmateAnimationEnabledRef, useMoveQualitySpinAnimationEnabledRef } from '../contexts/AppPreferencesContext';
import { useChessSound } from '../contexts/ChessSoundContext';
import {
  fileLabels,
  promotionPickerPosition,
  rankLabels,
  realIndicesFromVisual,
  squareFromPageCoords,
  squareToVisualPosition,
  toSquare,
  type BoardOrientation,
} from '../lib/boardOrientation';
import { describeGameResult } from '../lib/gameResult';
import { findKingSquare, winnerColorAfterCheckmate } from '../lib/kingSquare';
import {
  computeCapturedMaterial,
  visualBottomColor,
  visualTopColor,
} from '../lib/capturedPieces';
import { formatOpeningLabel, getOpeningBook } from '../lib/openingBook';
import { formatMoveHistory } from '../lib/moveHistory';
import { chooseBotMove, botColorForPlayer, botMoveUsesStockfish, waitForBotMoveRevealDelay, waitForNextFrame } from '../lib/botOpponent';
import { isAnalysisCancelled } from '../lib/stockfishCancel';
import { parseUciMove } from '../lib/uciParse';
import type { Bot } from '../lib/bots';
import { useStockfishEngine } from './StockfishWebViewEngine';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../theme';

const HORIZONTAL_PADDING = 12;
const EVAL_BAR_WIDTH = 24;
const EVAL_BAR_MARGIN = 6;
const RANK_NOTATION_WIDTH = 14;
const BOARD_BORDER = 2;
const LIGHT_SQUARE = '#f2dcc0';
const DARK_SQUARE = '#b58863';
const SELECTED_SQUARE = 'rgba(20, 85, 30, 0.55)';
const HOVER_SQUARE = 'rgba(180, 140, 40, 0.45)';
const LEGAL_MOVE_DOT = 'rgba(0, 0, 0, 0.21)';
const LEGAL_CAPTURE_RING = 'rgba(0, 0, 0, 0.18)';
const HINT_DISPLAY_MS = 5000;
/** Warn if Stockfish never reaches ready during a bot game (production-visible). */
const BOT_ENGINE_READY_WARN_MS = 25_000;

function botDiagLog(message: string, data?: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  if (data) {
    console.log(`[Bot Diag] ${message}`, data);
  } else {
    console.log(`[Bot Diag] ${message}`);
  }
}

type HintDisplay = {
  from: Square;
  to: Square;
  showArrow: boolean;
};

type CelebrationGlow = {
  square: Square;
  classification: 'Brilliant' | 'Great';
  effectKey: number;
};

type EasterEggAnimation = {
  from: Square;
  to: Square;
  piece: { color: Color; type: PieceSymbol };
  effectKey: number;
};

type CheckmateOverlayState = {
  matingSquare: Square;
  winningKingSquare: Square;
  losingKingSquare: Square;
  effectKey: number;
};

type BoardLayout = {
  x: number;
  y: number;
  size: number;
};

type DragOverlayState = {
  from: Square;
  piece: { color: Color; type: PieceSymbol };
};

type MoveSlideAnimation = {
  from: Square;
  to: Square;
  piece: { color: Color; type: PieceSymbol };
  startTranslateX: number;
  startTranslateY: number;
  effectKey: number;
  intent: 'commit' | 'promotion' | 'return';
  isCapture: boolean;
};

type IllegalMoveShake = {
  square: Square;
  piece: { color: Color; type: PieceSymbol };
  effectKey: number;
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
  clearSelection: () => void;
  finishDrag: (
    from: Square,
    pageX: number,
    pageY: number,
    lastGesture: { dx: number; dy: number } | null,
    releaseGesture: { dx: number; dy: number } | null,
  ) => void;
  handleSquarePress: (square: Square) => void;
  canMoveFrom: (square: Square) => boolean;
  canHandleSquarePress: () => boolean;
  shouldClaimPieceSquarePan: (square: Square) => boolean;
  boardOrientation: BoardOrientation;
};

function dragTranslateFromPage(
  from: Square,
  pageX: number,
  pageY: number,
  layout: BoardLayout,
  squareSize: number,
  pieceSize: number,
  orientation: BoardOrientation,
): { x: number; y: number } {
  const fromPos = squareToVisualPosition(from, squareSize, orientation);
  const pieceInset = (squareSize - pieceSize) / 2;
  const pieceCenterPageX = layout.x + fromPos.left + pieceInset + pieceSize / 2;
  const pieceCenterPageY = layout.y + fromPos.top + pieceInset + pieceSize / 2;
  return { x: pageX - pieceCenterPageX, y: pageY - pieceCenterPageY };
}

function setDragTranslateFromPage(
  from: Square,
  pageX: number,
  pageY: number,
  layout: BoardLayout,
  pieceSize: number,
  orientation: BoardOrientation,
  translateX: Animated.Value,
  translateY: Animated.Value,
): { x: number; y: number } {
  const squareSize = layout.size / 8;
  const translate = dragTranslateFromPage(
    from,
    pageX,
    pageY,
    layout,
    squareSize,
    pieceSize,
    orientation,
  );
  translateX.setValue(translate.x);
  translateY.setValue(translate.y);
  return translate;
}

function hasDragOffset(gesture: { dx: number; dy: number } | null): boolean {
  return gesture != null && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2);
}

/** Match the visible drag overlay at drop — release gesture.dx/dy is often 0. */
function resolveDropTranslate(
  from: Square,
  pageX: number,
  pageY: number,
  lastGesture: { dx: number; dy: number } | null,
  releaseGesture: { dx: number; dy: number } | null,
  layout: BoardLayout,
  squareSize: number,
  pieceSize: number,
  orientation: BoardOrientation,
): { x: number; y: number } {
  if (hasDragOffset(lastGesture)) {
    // PanResponder gestures use dx/dy; startMoveSlide expects x/y.
    return { x: lastGesture!.dx, y: lastGesture!.dy };
  }
  if (hasDragOffset(releaseGesture)) {
    return { x: releaseGesture!.dx, y: releaseGesture!.dy };
  }
  return dragTranslateFromPage(from, pageX, pageY, layout, squareSize, pieceSize, orientation);
}

function renderSquareRows(
  renderSquare: (visualRankIndex: number, visualFileIndex: number) => ReactNode,
) {
  return Array.from({ length: 8 }, (_, visualRankIndex) =>
    Array.from({ length: 8 }, (_, visualFileIndex) =>
      renderSquare(visualRankIndex, visualFileIndex),
    ),
  );
}

export default function ChessBoard({
  onBack,
  bot,
  gameMode = 'free',
}: {
  onBack?: () => void;
  bot?: Bot;
  gameMode?: 'free' | 'bot' | 'puzzle';
}) {
  const theme = useTheme();
  const chromeStyles = useMemo(() => createBoardChromeStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();

  const boardRowChrome =
    HORIZONTAL_PADDING * 2 +
    EVAL_BAR_WIDTH +
    EVAL_BAR_MARGIN +
    RANK_NOTATION_WIDTH +
    BOARD_BORDER;
  const boardSize = Math.max(0, Math.floor(windowWidth - boardRowChrome));
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
    clearSelection: () => undefined,
    finishDrag: () => undefined,
    handleSquarePress: () => undefined,
    canMoveFrom: () => false,
    canHandleSquarePress: () => false,
    shouldClaimPieceSquarePan: () => false,
    boardOrientation: 'white',
  });
  const boardOrientationRef = useRef<BoardOrientation>('white');
  const panRespondersRef = useRef<Partial<Record<Square, ReturnType<typeof PanResponder.create>>>>({});
  const suppressPressRef = useRef(false);
  const movedDuringPanRef = useRef(false);
  const lastDragPageRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const pendingDragPageRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const pendingDragGestureRef = useRef<{ dx: number; dy: number } | null>(null);
  const hoverSquareRef = useRef<Square | null>(null);
  const selectedSquareRef = useRef<Square | null>(null);
  const wasSelectedAtPanGrantRef = useRef(false);
  const pieceSquarePressOnlyRef = useRef<Square | null>(null);
  const dragOverlayRef = useRef<DragOverlayState | null>(null);
  const activeDragFromRef = useRef<Square | null>(null);
  const dragTranslateX = useRef(new Animated.Value(0)).current;
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const moveSlideRef = useRef<MoveSlideAnimation | null>(null);
  const moveSlideEffectKeyRef = useRef(0);
  const illegalMoveShakeRef = useRef<IllegalMoveShake | null>(null);
  const illegalMoveShakeEffectKeyRef = useRef(0);

  const [boardVersion, setBoardVersion] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>('white');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const [moveSlide, setMoveSlide] = useState<MoveSlideAnimation | null>(null);
  const [illegalMoveShake, setIllegalMoveShake] = useState<IllegalMoveShake | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportEndedEarly, setReportEndedEarly] = useState(false);
  const [reportMoves, setReportMoves] = useState<ClassifiedMoveRecord[]>([]);
  const [openingLabel, setOpeningLabel] = useState<string | null>(null);
  const [hint, setHint] = useState<HintDisplay | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [celebrationGlow, setCelebrationGlow] = useState<CelebrationGlow | null>(null);
  const [easterEggAnimation, setEasterEggAnimation] = useState<EasterEggAnimation | null>(null);
  const [checkmateOverlay, setCheckmateOverlay] = useState<CheckmateOverlayState | null>(null);
  const autoReportShownRef = useRef(false);
  const botTurnScheduledRef = useRef<string | null>(null);
  const botActionEpochRef = useRef(0);
  const botTurnBlockCountRef = useRef<{ fen: string; count: number } | null>(null);
  const [botTurnRetryToken, setBotTurnRetryToken] = useState(0);
  const matchedOpeningRef = useRef<string | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintRequestRef = useRef(0);
  const celebrationGlowKeyRef = useRef(0);
  const easterEggEffectKeyRef = useRef(0);
  const easterEggAnimationRef = useRef<EasterEggAnimation | null>(null);
  const checkmateOverlayRef = useRef<CheckmateOverlayState | null>(null);
  const checkmateEffectKeyRef = useRef(0);
  dragOverlayRef.current = dragOverlay;
  moveSlideRef.current = moveSlide;
  illegalMoveShakeRef.current = illegalMoveShake;
  selectedSquareRef.current = selectedSquare;
  boardOrientationRef.current = boardOrientation;
  easterEggAnimationRef.current = easterEggAnimation;
  checkmateOverlayRef.current = checkmateOverlay;

  const {
    onMovePlayed,
    undoLastMove,
    resetClassification,
    latestClassification,
    positionEval,
    classifiedMovesRef,
    isAnalysisIdle,
    isEngineReady,
    enqueueEngineTask,
    requestBestMove,
  } = useMoveClassification();
  const { sendCommand, addLineListener, registerAnalysisCancel } = useStockfishEngine();
  const { playMoveSound, playIllegalSound } = useChessSound();
  const checkmateAnimationEnabledRef = useCheckmateAnimationEnabledRef();
  const moveQualitySpinAnimationEnabledRef = useMoveQualitySpinAnimationEnabledRef();

  const isBotGame = bot != null;
  const playerColor: Color = boardOrientation === 'white' ? 'w' : 'b';
  const botColor: Color = botColorForPlayer(playerColor);

  const noteBotTurnScheduleFailure = useCallback((fen: string, reason: string) => {
    const previous = botTurnBlockCountRef.current;
    const count = previous?.fen === fen ? previous.count + 1 : 1;
    botTurnBlockCountRef.current = { fen, count };
    if (count > 1) {
      console.warn(
        `[Bot Opponent] bot turn blocked again for the same position (attempt ${count}): ${reason}`,
      );
    }
  }, []);

  const requestBotTurnRetry = useCallback(
    (fen: string, reason: string) => {
      const current = gameRef.current;
      if (current.isGameOver() || current.turn() !== botColor) {
        return;
      }
      noteBotTurnScheduleFailure(fen, reason);
      botTurnScheduledRef.current = null;
      setBotTurnRetryToken((token) => token + 1);
    },
    [botColor, noteBotTurnScheduleFailure],
  );

  const isRecoverableBotSearchError = useCallback((error: unknown): boolean => {
    if (isAnalysisCancelled(error)) {
      return true;
    }
    return error instanceof Error && error.message.includes('timed out');
  }, []);

  const game = gameRef.current;
  const board = game.board();
  const gameOver = game.isGameOver();
  const turn = game.turn();
  const moveHistory = game.history();
  const capturedMaterial = useMemo(
    () => computeCapturedMaterial(game),
    [game, boardVersion],
  );
  const topSideColor = visualTopColor(boardOrientation);
  const bottomSideColor = visualBottomColor(boardOrientation);
  const capturedPieceIconSize = Math.max(20, Math.min(28, squareSize * 0.38));
  const topSideCaptures =
    topSideColor === 'w' ? capturedMaterial.white : capturedMaterial.black;
  const bottomSideCaptures =
    bottomSideColor === 'w' ? capturedMaterial.white : capturedMaterial.black;
  const topCaptureAdvantage =
    capturedMaterial.advantage?.side === topSideColor
      ? capturedMaterial.advantage.points
      : null;
  const bottomCaptureAdvantage =
    capturedMaterial.advantage?.side === bottomSideColor
      ? capturedMaterial.advantage.points
      : null;
  const canUndo = !gameOver && !pendingPromotion && moveHistory.length > 0;
  const moveHistoryLabel = formatMoveHistory(moveHistory);

  const legalMoves: Move[] = useMemo(() => {
    if (!selectedSquare || gameOver || pendingPromotion) {
      return [];
    }
    return game.moves({ square: selectedSquare, verbose: true });
  }, [game, gameOver, pendingPromotion, selectedSquare, boardVersion]);

  const legalMoveSquares = useMemo(
    () => new Set(legalMoves.map((move) => move.to)),
    [legalMoves],
  );
  const captureSquares = useMemo(
    () => new Set(legalMoves.filter((move) => move.isCapture()).map((move) => move.to)),
    [legalMoves],
  );

  const canRequestHint =
    !gameOver &&
    !pendingPromotion &&
    isEngineReady &&
    (!isBotGame || turn === playerColor);

  const clearHint = useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
    setHint(null);
  }, []);

  const scheduleHintClear = useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
    }
    hintTimeoutRef.current = setTimeout(() => {
      setHint(null);
      hintTimeoutRef.current = null;
    }, HINT_DISPLAY_MS);
  }, []);

  const requestHintDisplay = useCallback(
    async (showArrow: boolean) => {
      if (!canRequestHint) {
        return;
      }

      clearHint();
      const requestId = hintRequestRef.current + 1;
      hintRequestRef.current = requestId;
      setHintLoading(true);

      try {
        const uci = await requestBestMove(gameRef.current.fen());
        if (requestId !== hintRequestRef.current) {
          return;
        }

        const parsed = parseUciMove(uci);
        if (!parsed) {
          return;
        }

        setHint({
          from: parsed.from,
          to: parsed.to,
          showArrow,
        });
        scheduleHintClear();
      } catch (error) {
        if (!isAnalysisCancelled(error)) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('[Hint] best move lookup failed:', message);
        }
      } finally {
        if (requestId === hintRequestRef.current) {
          setHintLoading(false);
        }
      }
    },
    [canRequestHint, clearHint, requestBestMove, scheduleHintClear],
  );

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
    };
  }, []);

  const clearCelebrationGlow = useCallback(() => {
    setCelebrationGlow(null);
  }, []);

  const clearMoveQualitySpinAnimation = useCallback(() => {
    setEasterEggAnimation(null);
  }, []);

  useEffect(() => {
    if (!latestClassification) {
      return;
    }

    const { classification, square } = latestClassification;
    if (classification !== 'Brilliant' && classification !== 'Great') {
      return;
    }

    celebrationGlowKeyRef.current += 1;
    setCelebrationGlow({
      square,
      classification,
      effectKey: celebrationGlowKeyRef.current,
    });

    if (!moveQualitySpinAnimationEnabledRef.current) {
      return;
    }

    const piece = gameRef.current.get(square);
    if (!piece) {
      return;
    }

    easterEggEffectKeyRef.current += 1;
    setEasterEggAnimation({
      from: square,
      to: square,
      piece: { color: piece.color, type: piece.type },
      effectKey: easterEggEffectKeyRef.current,
    });
  }, [latestClassification]);

  const notifyMoveSound = useCallback(
    (move: Move) => {
      playMoveSound(move, gameRef.current, playerColor);
    },
    [playMoveSound, playerColor],
  );

  const refreshBoard = useCallback(() => {
    setBoardVersion((version) => version + 1);
  }, []);

  const clearDragVisual = useCallback(() => {
    activeDragFromRef.current = null;
    dragOverlayRef.current = null;
    setDragOverlay(null);
    pendingDragPageRef.current = null;
    pendingDragGestureRef.current = null;
    hoverSquareRef.current = null;
    setHoverSquare(null);
  }, []);

  const clearDragSession = useCallback(() => {
    clearDragVisual();
    dragTranslateX.setValue(0);
    dragTranslateY.setValue(0);
    setMoveSlide(null);
  }, [clearDragVisual, dragTranslateX, dragTranslateY]);

  const resetGame = useCallback(() => {
    gameRef.current.reset();
    panRespondersRef.current = {};
    setSelectedSquare(null);
    clearDragSession();
    setIllegalMoveShake(null);
    setPendingPromotion(null);
    setReportVisible(false);
    setReportEndedEarly(false);
    setReportMoves([]);
    autoReportShownRef.current = false;
    botTurnScheduledRef.current = null;
    botTurnBlockCountRef.current = null;
    matchedOpeningRef.current = null;
    setOpeningLabel(null);
    hintRequestRef.current += 1;
    clearHint();
    clearCelebrationGlow();
    clearMoveQualitySpinAnimation();
    setCheckmateOverlay(null);
    resetClassification();
    refreshBoard();
  }, [clearCelebrationGlow, clearDragSession, clearHint, clearMoveQualitySpinAnimation, refreshBoard, resetClassification]);

  const undoMove = useCallback(() => {
    // TODO: puzzle mode undo behavior — reset to puzzle start position vs single-ply undo.
    if (gameMode === 'puzzle') {
      return;
    }

    if (gameOver || pendingPromotion || gameRef.current.history().length === 0) {
      return;
    }

    const undone = gameRef.current.undo();
    if (!undone) {
      return;
    }

    botActionEpochRef.current += 1;
    botTurnScheduledRef.current = null;
    botTurnBlockCountRef.current = null;
    setSelectedSquare(null);
    clearDragSession();
    setPendingPromotion(null);
    clearHint();
    clearCelebrationGlow();
    undoLastMove(gameRef.current.fen());
    refreshBoard();
  }, [clearCelebrationGlow, clearDragSession, clearHint, gameMode, gameOver, pendingPromotion, refreshBoard, undoLastMove]);

  const tryOpenAutoReport = useCallback(() => {
    if (checkmateOverlayRef.current) {
      return;
    }
    if (
      gameOver &&
      !autoReportShownRef.current &&
      classifiedMovesRef.current.length > 0 &&
      isAnalysisIdle
    ) {
      autoReportShownRef.current = true;
      setReportMoves([...classifiedMovesRef.current]);
      setReportEndedEarly(false);
      setReportVisible(true);
    }
  }, [classifiedMovesRef, gameOver, isAnalysisIdle]);

  const openAccuracyReport = useCallback((endedEarly: boolean) => {
    if (classifiedMovesRef.current.length === 0) {
      return;
    }
    setReportMoves([...classifiedMovesRef.current]);
    setReportEndedEarly(endedEarly);
    setReportVisible(true);
  }, [classifiedMovesRef]);

  const handleCheckmateOverlayComplete = useCallback(() => {
    setCheckmateOverlay(null);
    tryOpenAutoReport();
  }, [tryOpenAutoReport]);

  const maybeStartCheckmateAnimation = useCallback((move: Move) => {
    if (!checkmateAnimationEnabledRef.current) {
      return;
    }
    if (!gameRef.current.isCheckmate()) {
      return;
    }

    const winnerColor = winnerColorAfterCheckmate(gameRef.current);
    const losingColor = gameRef.current.turn();
    const winningKingSquare = findKingSquare(gameRef.current, winnerColor);
    const losingKingSquare = findKingSquare(gameRef.current, losingColor);
    if (!winningKingSquare || !losingKingSquare) {
      return;
    }

    checkmateEffectKeyRef.current += 1;
    setCheckmateOverlay({
      matingSquare: move.to,
      winningKingSquare,
      losingKingSquare,
      effectKey: checkmateEffectKeyRef.current,
    });
  }, [checkmateAnimationEnabledRef]);

  useEffect(() => {
    tryOpenAutoReport();
  }, [boardVersion, tryOpenAutoReport]);

  useEffect(() => {
    const match = getOpeningBook().lookupOpening(game.history());
    if (match) {
      const label = formatOpeningLabel(match.name);
      matchedOpeningRef.current = label;
      setOpeningLabel(label);
      return;
    }

    if (matchedOpeningRef.current) {
      setOpeningLabel(matchedOpeningRef.current);
      return;
    }

    setOpeningLabel(null);
  }, [boardVersion, game]);

  useEffect(() => {
    if (!isBotGame || !bot || gameOver || !botMoveUsesStockfish(bot) || isEngineReady) {
      return;
    }

    const timer = setTimeout(() => {
      console.warn(
        `[Bot Opponent] Stockfish engine not ready after ${BOT_ENGINE_READY_WARN_MS}ms — bot moves are waiting for the engine.`,
      );
    }, BOT_ENGINE_READY_WARN_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [bot, gameOver, isBotGame, isEngineReady, turn]);

  useEffect(() => {
    const turnKey = game.fen();
    botDiagLog('bot-turn effect fired', {
      turn,
      botColor,
      fen: turnKey,
      botTurnScheduledRef: botTurnScheduledRef.current,
      botActionEpoch: botActionEpochRef.current,
      isBotGame,
      gameOver,
      pendingPromotion: Boolean(pendingPromotion),
      isEngineReady,
      botBehavior: bot?.behavior,
      botId: bot?.id,
    });

    if (!isBotGame || !bot || gameOver || pendingPromotion) {
      botDiagLog('bot-turn effect exit', { reason: 'preconditions' });
      return;
    }
    if (botMoveUsesStockfish(bot) && !isEngineReady) {
      botDiagLog('bot-turn effect exit', { reason: 'engine_not_ready' });
      return;
    }
    if (turn !== botColor) {
      botTurnScheduledRef.current = null;
      botTurnBlockCountRef.current = null;
      botDiagLog('bot-turn effect exit', { reason: 'not_bot_turn' });
      return;
    }

    if (moveSlideRef.current?.intent === 'commit') {
      botDiagLog('bot-turn effect exit', { reason: 'human_commit_slide_in_progress' });
      return;
    }

    if (botTurnScheduledRef.current === turnKey) {
      botDiagLog('bot-turn effect exit', {
        reason: 'dedup_guard',
        fen: turnKey,
        botTurnScheduledRef: botTurnScheduledRef.current,
      });
      return;
    }
    botTurnScheduledRef.current = turnKey;
    botDiagLog('bot-turn scheduled', {
      fen: turnKey,
      botTurnScheduledRef: botTurnScheduledRef.current,
    });

    let cancelled = false;
    const epoch = botActionEpochRef.current;

    void (async () => {
      await waitForNextFrame();
      if (cancelled || botActionEpochRef.current !== epoch) {
        botTurnScheduledRef.current = null;
        botDiagLog('bot-turn async aborted after frame', {
          cancelled,
          epoch,
          botActionEpoch: botActionEpochRef.current,
          botTurnScheduledRef: botTurnScheduledRef.current,
        });
        return;
      }

      const revealDelayStartedAt = Date.now();
      const revealDelayPromise = waitForBotMoveRevealDelay(revealDelayStartedAt);

      const applyBotMove = async () => {
        const applyStartedAt = Date.now();
        const fenAtSearchStart = game.fen();
        const historyAtSearchStart = game.history();
        botDiagLog('applyBotMove start', {
          fen: fenAtSearchStart,
          ply: historyAtSearchStart.length,
          botTurnScheduledRef: botTurnScheduledRef.current,
          epoch,
          botActionEpoch: botActionEpochRef.current,
          cancelled,
        });

        const finishApplyBotMove = (outcome: string, extra?: Record<string, unknown>) => {
          botDiagLog('applyBotMove end', {
            outcome,
            elapsedMs: Date.now() - applyStartedAt,
            fen: fenAtSearchStart,
            botTurnScheduledRef: botTurnScheduledRef.current,
            ...extra,
          });
        };

        if (
          cancelled ||
          botActionEpochRef.current !== epoch ||
          game.turn() !== botColor ||
          game.isGameOver()
        ) {
          botTurnScheduledRef.current = null;
          finishApplyBotMove('early_exit_pre_search', {
            cancelled,
            epoch,
            botActionEpoch: botActionEpochRef.current,
            turn: game.turn(),
            gameOver: game.isGameOver(),
          });
          return;
        }

        try {
          const botMove = await chooseBotMove(
            fenAtSearchStart,
            bot,
            historyAtSearchStart,
            sendCommand,
            addLineListener,
            registerAnalysisCancel,
          );
          await revealDelayPromise;

          if (
            cancelled ||
            botActionEpochRef.current !== epoch ||
            !botMove ||
            game.fen() !== fenAtSearchStart ||
            game.turn() !== botColor
          ) {
            botTurnScheduledRef.current = null;
            const stillBotTurn =
              !cancelled &&
              botActionEpochRef.current === epoch &&
              game.turn() === botColor &&
              !game.isGameOver();
            finishApplyBotMove('post_search_validation_failed', {
              cancelled,
              botMove,
              fenNow: game.fen(),
              stillBotTurn,
            });
            if (stillBotTurn && game.fen() === fenAtSearchStart) {
              requestBotTurnRetry(fenAtSearchStart, 'post-move validation failed');
            }
            return;
          }

          const result = gameRef.current.move(botMove);
          if (!result) {
            botTurnScheduledRef.current = null;
            console.warn('[Bot Opponent] failed to apply move', botMove);
            finishApplyBotMove('apply_move_failed', { botMove });
            requestBotTurnRetry(fenAtSearchStart, 'failed to apply move on board');
            return;
          }

          botTurnBlockCountRef.current = null;

          notifyMoveSound(result);
          refreshBoard();
          onMovePlayed(result, fenAtSearchStart);
          maybeStartCheckmateAnimation(result);
          finishApplyBotMove('success', { san: result.san, botMove });
        } catch (error) {
          botTurnScheduledRef.current = null;
          const message = error instanceof Error ? error.message : String(error);
          if (isRecoverableBotSearchError(error)) {
            finishApplyBotMove('recoverable_error', { error: message });
            requestBotTurnRetry(
              fenAtSearchStart,
              isAnalysisCancelled(error) ? 'analysis cancelled' : 'search timed out',
            );
            return;
          }
          finishApplyBotMove('fatal_error', { error: message });
          console.warn('[Bot Opponent] move failed:', message);
        }
      };

      if (botMoveUsesStockfish(bot)) {
        botDiagLog('applyBotMove enqueued', { fen: turnKey });
        enqueueEngineTask(applyBotMove);
      } else {
        botDiagLog('applyBotMove direct (no queue)', { fen: turnKey });
        void applyBotMove();
      }
    })();

    return () => {
      cancelled = true;
      botDiagLog('bot-turn effect cleanup', {
        cancelled: true,
        fen: turnKey,
        botTurnScheduledRef: botTurnScheduledRef.current,
        botActionEpoch: botActionEpochRef.current,
      });
    };
  }, [
    addLineListener,
    bot,
    botColor,
    boardOrientation,
    enqueueEngineTask,
    gameOver,
    isBotGame,
    isEngineReady,
    pendingPromotion,
    refreshBoard,
    registerAnalysisCancel,
    sendCommand,
    onMovePlayed,
    notifyMoveSound,
    turn,
    boardVersion,
    moveSlide,
    botTurnRetryToken,
    maybeStartCheckmateAnimation,
    requestBotTurnRetry,
    isRecoverableBotSearchError,
  ]);

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, width) => {
      boardLayoutRef.current = { x, y, size: width };
    });
    wrapperRef.current?.measureInWindow((x, y) => {
      wrapperOffsetRef.current = { x, y };
    });
  }, []);

  const canMoveFrom = useCallback(
    (square: Square) => {
      if (checkmateOverlayRef.current) {
        return false;
      }
      if (easterEggAnimationRef.current) {
        return false;
      }
      if (dragOverlayRef.current || moveSlideRef.current || illegalMoveShakeRef.current) {
        return false;
      }
      if (gameOver || pendingPromotion) {
        return false;
      }
      const piece = game.get(square);
      if (!piece || piece.color !== turn) {
        return false;
      }
      if (isBotGame && turn !== playerColor) {
        return false;
      }
      return true;
    },
    [game, gameOver, isBotGame, pendingPromotion, playerColor, turn],
  );

  const canHandleSquarePress = useCallback(() => {
    if (dragOverlayRef.current || moveSlideRef.current || illegalMoveShakeRef.current) {
      return false;
    }
    if (gameOver || pendingPromotion) {
      return false;
    }
    if (isBotGame && turn !== playerColor) {
      return false;
    }
    return true;
  }, [gameOver, isBotGame, pendingPromotion, playerColor, turn]);

  const shouldClaimPieceSquarePan = useCallback(
    (square: Square) => canMoveFrom(square) || canHandleSquarePress(),
    [canHandleSquarePress, canMoveFrom],
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
      if (isBotGame && turn !== playerColor) {
        clearSelection();
        return;
      }
      setSelectedSquare(square);
    },
    [clearSelection, game, gameOver, isBotGame, playerColor, turn],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    clearSelection();
    clearDragSession();
  }, [clearDragSession, clearSelection]);

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

      if (result) {
        notifyMoveSound(result);
      }

      setPendingPromotion(null);
      clearSelection();
      clearDragSession();
      refreshBoard();

      if (result) {
        clearHint();
        onMovePlayed(result, fenBefore);
        maybeStartCheckmateAnimation(result);
      }
    },
    [clearDragSession, clearHint, clearSelection, game, maybeStartCheckmateAnimation, notifyMoveSound, onMovePlayed, pendingPromotion, refreshBoard],
  );

  const tryMove = useCallback(
    (from: Square, to: Square, options?: { keepSlideOverlay?: boolean }) => {
      const moves = game.moves({ square: from, verbose: true });
      const move = moves.find((candidate) => candidate.to === to);

      if (!move) {
        return false;
      }

      if (move.isPromotion()) {
        setPendingPromotion({ from, to, color: game.turn() });
        clearSelection();
        clearDragSession();
        return true;
      }

      const fenBefore = game.fen();
      const result = game.move({ from, to });

      if (result) {
        notifyMoveSound(result);
      }

      clearSelection();
      if (options?.keepSlideOverlay) {
        clearDragVisual();
      } else {
        clearDragSession();
      }
      refreshBoard();

      if (result) {
        clearHint();
        onMovePlayed(result, fenBefore);
        maybeStartCheckmateAnimation(result);
      }
      return Boolean(result);
    },
    [clearDragSession, clearDragVisual, clearHint, clearSelection, game, maybeStartCheckmateAnimation, notifyMoveSound, onMovePlayed, refreshBoard],
  );

  const startMoveSlide = useCallback(
    (
      from: Square,
      to: Square,
      piece: { color: Color; type: PieceSymbol },
      translate: { x: number; y: number },
      intent: MoveSlideAnimation['intent'],
      isCapture = false,
    ) => {
      moveSlideEffectKeyRef.current += 1;
      const nextSlide: MoveSlideAnimation = {
        from,
        to,
        piece,
        startTranslateX: translate.x,
        startTranslateY: translate.y,
        effectKey: moveSlideEffectKeyRef.current,
        intent,
        isCapture,
      };
      moveSlideRef.current = nextSlide;
      setMoveSlide(nextSlide);
    },
    [],
  );

  const beginAnimatedMove = useCallback(
    (
      from: Square,
      to: Square,
      translate: { x: number; y: number },
    ): boolean => {
      const piece = gameRef.current.get(from);
      if (!piece) {
        return false;
      }

      const moves = gameRef.current.moves({ square: from, verbose: true });
      const move = moves.find((candidate) => candidate.to === to);
      if (!move) {
        return false;
      }

      const piecePayload = { color: piece.color, type: piece.type };

      clearSelection();

      if (move.isPromotion()) {
        startMoveSlide(from, to, piecePayload, translate, 'promotion', false);
        clearDragVisual();
        return true;
      }

      startMoveSlide(from, to, piecePayload, translate, 'commit', move.isCapture());
      tryMove(from, to, { keepSlideOverlay: true });
      clearDragVisual();
      return true;
    },
    [clearDragVisual, clearSelection, startMoveSlide, tryMove],
  );

  const handleMoveSlideComplete = useCallback(() => {
    const slide = moveSlideRef.current;
    if (!slide) {
      return;
    }

    setMoveSlide(null);
    moveSlideRef.current = null;
    const { intent } = slide;

    if (intent === 'commit') {
      return;
    }

    const { from, to } = slide;

    if (intent === 'promotion') {
      setPendingPromotion({ from, to, color: gameRef.current.turn() });
      clearSelection();
      return;
    }

    clearSelection();
  }, [clearSelection]);

  const startIllegalMoveShake = useCallback((square: Square) => {
    const piece = gameRef.current.get(square);
    if (!piece) {
      return;
    }

    illegalMoveShakeEffectKeyRef.current += 1;
    setIllegalMoveShake({
      square,
      piece: { color: piece.color, type: piece.type },
      effectKey: illegalMoveShakeEffectKeyRef.current,
    });
  }, []);

  const handleIllegalMoveShakeComplete = useCallback(() => {
    setIllegalMoveShake(null);
  }, []);

  const handleEasterEggComplete = useCallback(() => {
    setEasterEggAnimation(null);
  }, []);

  const handleSquarePress = useCallback(
    (square: Square) => {
      if (dragOverlayRef.current || moveSlideRef.current || illegalMoveShakeRef.current) {
        return;
      }
      if (suppressPressRef.current) {
        suppressPressRef.current = false;
        return;
      }
      if (gameOver || pendingPromotion) {
        return;
      }
      if (isBotGame && turn !== playerColor) {
        return;
      }

      if (selectedSquare) {
        if (selectedSquare === square) {
          clearSelection();
          return;
        }

        if (beginAnimatedMove(selectedSquare, square, { x: 0, y: 0 })) {
          return;
        }

        playIllegalSound();
        startIllegalMoveShake(selectedSquare);
        return;
      }

      selectSquare(square);
    },
    [beginAnimatedMove, clearSelection, gameOver, isBotGame, pendingPromotion, playIllegalSound, playerColor, selectSquare, selectedSquare, startIllegalMoveShake, turn],
  );

  const finishDrag = useCallback(
    (
      from: Square,
      pageX: number,
      pageY: number,
      lastGesture: { dx: number; dy: number } | null,
      releaseGesture: { dx: number; dy: number } | null,
    ) => {
      const layout = boardLayoutRef.current;
      const targetSquare = squareFromPageCoords(
        pageX,
        pageY,
        layout,
        boardOrientationRef.current,
      );
      const piece = gameRef.current.get(from);
      const translate = resolveDropTranslate(
        from,
        pageX,
        pageY,
        lastGesture,
        releaseGesture,
        layout,
        squareSize,
        pieceSize,
        boardOrientationRef.current,
      );

      clearSelection();

      if (!piece) {
        clearDragVisual();
        return;
      }

      const piecePayload = { color: piece.color, type: piece.type };

      if (targetSquare && targetSquare !== from) {
        if (beginAnimatedMove(from, targetSquare, translate)) {
          return;
        }

        playIllegalSound();
        startMoveSlide(from, from, piecePayload, translate, 'return', false);
        clearDragVisual();
        return;
      }

      startMoveSlide(from, from, piecePayload, translate, 'return', false);
      clearDragVisual();
    },
    [beginAnimatedMove, boardOrientationRef, clearDragVisual, clearSelection, pieceSize, playIllegalSound, squareSize, startMoveSlide],
  );

  const completePanEnd = useCallback(
    (
      from: Square,
      dropPageX: number,
      dropPageY: number,
      movedEnough: boolean,
      gesture: { dx: number; dy: number } | null,
    ) => {
      const layout = boardLayoutRef.current;
      const dropSquare = squareFromPageCoords(
        dropPageX,
        dropPageY,
        layout,
        boardOrientationRef.current,
      );
      const didDrag = movedEnough || (dropSquare !== null && dropSquare !== from);

      const lastGesture = pendingDragGestureRef.current;

      movedDuringPanRef.current = false;
      lastDragPageRef.current = null;
      pendingDragPageRef.current = null;
      pendingDragGestureRef.current = null;
      activeDragFromRef.current = null;

      if (didDrag) {
        suppressPressRef.current = true;
        interactionHandlersRef.current.finishDrag(
          from,
          dropPageX,
          dropPageY,
          lastGesture,
          gesture,
        );
      } else {
        if (wasSelectedAtPanGrantRef.current) {
          interactionHandlersRef.current.clearSelection();
        }
        wasSelectedAtPanGrantRef.current = false;
        clearDragVisual();
      }
    },
    [],
  );

  interactionHandlersRef.current = {
    gameOver,
    turn,
    pieceSize,
    selectSquare,
    clearSelection,
    finishDrag,
    handleSquarePress,
    canMoveFrom,
    canHandleSquarePress,
    shouldClaimPieceSquarePan,
    boardOrientation,
  };

  const getPiecePanResponder = (square: Square) => {
    if (!panRespondersRef.current[square]) {
      panRespondersRef.current[square] = PanResponder.create({
        onStartShouldSetPanResponder: () =>
          interactionHandlersRef.current.shouldClaimPieceSquarePan(square),
        onMoveShouldSetPanResponder: () => {
          const active = activeDragFromRef.current;
          return active ? active === square : false;
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          if (!interactionHandlersRef.current.canMoveFrom(square)) {
            if (!interactionHandlersRef.current.canHandleSquarePress()) {
              return;
            }
            pieceSquarePressOnlyRef.current = square;
            return;
          }

          activeDragFromRef.current = square;
          movedDuringPanRef.current = false;
          const pageX = event.nativeEvent.pageX;
          const pageY = event.nativeEvent.pageY;
          lastDragPageRef.current = { pageX, pageY };
          pendingDragPageRef.current = { pageX, pageY };
          pendingDragGestureRef.current = null;
          measureBoard();
          wrapperRef.current?.measureInWindow((x, y) => {
            wrapperOffsetRef.current = { x, y };
          });
          boardRef.current?.measureInWindow((x, y, width) => {
            boardLayoutRef.current = { x, y, size: width };
            if (activeDragFromRef.current !== square) {
              return;
            }
            const grantPage = pendingDragPageRef.current;
            if (!grantPage) {
              return;
            }
            const translate = setDragTranslateFromPage(
              square,
              grantPage.pageX,
              grantPage.pageY,
              boardLayoutRef.current,
              interactionHandlersRef.current.pieceSize,
              boardOrientationRef.current,
              dragTranslateX,
              dragTranslateY,
            );
            pendingDragGestureRef.current = { dx: translate.x, dy: translate.y };
          });

          const picked = gameRef.current.get(square);
          if (picked) {
            const overlay = {
              from: square,
              piece: { color: picked.color, type: picked.type },
            };
            dragOverlayRef.current = overlay;
            setDragOverlay(overlay);

            const translate = setDragTranslateFromPage(
              square,
              pageX,
              pageY,
              boardLayoutRef.current,
              interactionHandlersRef.current.pieceSize,
              boardOrientationRef.current,
              dragTranslateX,
              dragTranslateY,
            );
            pendingDragGestureRef.current = { dx: translate.x, dy: translate.y };
          }

          wasSelectedAtPanGrantRef.current = selectedSquareRef.current === square;
          interactionHandlersRef.current.selectSquare(square);
        },
        onPanResponderMove: (event, gesture) => {
          // PanResponder is JS-thread-only — track via page coords so the piece
          // center stays under the finger (grant offset + raw dx/dy would jump).
          const pageX = event.nativeEvent.pageX;
          const pageY = event.nativeEvent.pageY;
          const translate = setDragTranslateFromPage(
            square,
            pageX,
            pageY,
            boardLayoutRef.current,
            interactionHandlersRef.current.pieceSize,
            boardOrientationRef.current,
            dragTranslateX,
            dragTranslateY,
          );

          lastDragPageRef.current = { pageX, pageY };
          pendingDragPageRef.current = { pageX, pageY };
          pendingDragGestureRef.current = { dx: translate.x, dy: translate.y };

          const hoverTarget = squareFromPageCoords(
            pageX,
            pageY,
            boardLayoutRef.current,
            boardOrientationRef.current,
          );
          if (hoverTarget !== hoverSquareRef.current) {
            hoverSquareRef.current = hoverTarget;
            setHoverSquare(hoverTarget);
          }

          if (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2) {
            movedDuringPanRef.current = true;
          }
        },
        onPanResponderRelease: (event, gesture) => {
          if (pieceSquarePressOnlyRef.current === square) {
            pieceSquarePressOnlyRef.current = null;
            interactionHandlersRef.current.handleSquarePress(square);
            return;
          }

          const movedEnough =
            movedDuringPanRef.current ||
            Math.abs(gesture.dx) > 2 ||
            Math.abs(gesture.dy) > 2;
          const dropPageX = lastDragPageRef.current?.pageX ?? event.nativeEvent.pageX;
          const dropPageY = lastDragPageRef.current?.pageY ?? event.nativeEvent.pageY;
          completePanEnd(
            square,
            dropPageX,
            dropPageY,
            movedEnough,
            { dx: gesture.dx, dy: gesture.dy },
          );
        },
        onPanResponderTerminate: (event, gesture) => {
          if (pieceSquarePressOnlyRef.current === square) {
            pieceSquarePressOnlyRef.current = null;
            interactionHandlersRef.current.handleSquarePress(square);
            return;
          }

          const movedEnough =
            movedDuringPanRef.current ||
            Math.abs(gesture.dx) > 2 ||
            Math.abs(gesture.dy) > 2;
          const dropPageX = lastDragPageRef.current?.pageX ?? event.nativeEvent.pageX;
          const dropPageY = lastDragPageRef.current?.pageY ?? event.nativeEvent.pageY;
          completePanEnd(
            square,
            dropPageX,
            dropPageY,
            movedEnough,
            { dx: gesture.dx, dy: gesture.dy },
          );
        },
      });
    }

    return panRespondersRef.current[square]!;
  };

  const pickerPosition = pendingPromotion
    ? promotionPickerPosition(pendingPromotion.to, squareSize, boardOrientation)
    : null;

  const classificationBadgeSize = Math.max(18, squareSize * 0.28);
  const classificationBadgePosition = latestClassification
    ? squareToVisualPosition(latestClassification.square, squareSize, boardOrientation)
    : null;
  const classificationBadgeLeft =
    classificationBadgePosition == null
      ? 0
      : Math.min(
          classificationBadgePosition.left +
            squareSize -
            classificationBadgeSize * 0.55,
          boardSize - classificationBadgeSize,
        );
  const classificationBadgeTop =
    classificationBadgePosition == null
      ? 0
      : classificationBadgePosition.top + squareSize * 0.02;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={chromeStyles.sideSelectorAnchor} pointerEvents="box-none">
          <View style={chromeStyles.sideSelectorRow}>
          <Pressable
            style={({ pressed }) => [
              chromeStyles.sideSelectorButton,
              boardOrientation === 'white' && chromeStyles.sideSelectorButtonActive,
              pressed && chromeStyles.sideSelectorButtonPressed,
            ]}
            onPress={() => setBoardOrientation('white')}
            accessibilityRole="button"
            accessibilityLabel="Play as White"
          >
            <Text
              style={[
                chromeStyles.sideSelectorText,
                boardOrientation === 'white' && chromeStyles.sideSelectorTextActive,
              ]}
            >
              Play as White
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              chromeStyles.sideSelectorButton,
              boardOrientation === 'black' && chromeStyles.sideSelectorButtonActive,
              pressed && chromeStyles.sideSelectorButtonPressed,
            ]}
            onPress={() => setBoardOrientation('black')}
            accessibilityRole="button"
            accessibilityLabel="Play as Black"
          >
            <Text
              style={[
                chromeStyles.sideSelectorText,
                boardOrientation === 'black' && chromeStyles.sideSelectorTextActive,
              ]}
            >
              Play as Black
            </Text>
          </Pressable>
          </View>
      </SafeAreaView>

      <View ref={wrapperRef} style={styles.wrapper} onLayout={measureBoard}>
      <View style={[styles.boardRow, { maxWidth: windowWidth }]}>
          <EvalBar
            height={boardSize + BOARD_BORDER}
            eval={positionEval}
            boardOrientation={boardOrientation}
          />
        <View style={styles.boardColumn}>
          <CapturedPiecesBar
            captures={topSideCaptures}
            captorColor={topSideColor}
            advantagePoints={topCaptureAdvantage}
            width={boardSize}
            pieceIconSize={capturedPieceIconSize}
          />
          <View
            style={[
              styles.boardBorder,
              { width: boardSize + BOARD_BORDER, height: boardSize + BOARD_BORDER },
            ]}
          >
            <View
              ref={boardRef}
              style={[styles.board, { width: boardSize, height: boardSize }]}
              onLayout={measureBoard}
            >
              {renderSquareRows((visualRankIndex, visualFileIndex) => {
                const { fileIndex, rankIndex } = realIndicesFromVisual(
                  visualFileIndex,
                  visualRankIndex,
                  boardOrientation,
                );
                const square = toSquare(fileIndex, rankIndex);
                const cell = board[rankIndex][fileIndex];
                const isLight = (rankIndex + fileIndex) % 2 === 0;
                const isSelected = selectedSquare === square;
                const isHovered = hoverSquare === square;
                const isLegalMove = legalMoveSquares.has(square);
                const isCapture = captureSquares.has(square);
                const piece = cell;
                const isDraggingFromSquare =
                  dragOverlay?.from === square ||
                  moveSlide?.from === square ||
                  illegalMoveShake?.square === square;
                const isEasterEggFromSquare = easterEggAnimation?.from === square;
                const isPendingFrom = pendingPromotion?.from === square;
                const isPendingTo = pendingPromotion?.to === square;
                const isHiddenDuringCommitSlide =
                  moveSlide?.intent === 'commit' && moveSlide.to === square;
                const usePanResponderShell = !!piece;
                const showPiece = piece && !isPendingFrom && !isHiddenDuringCommitSlide;
                const squareStyle = [
                  styles.square,
                  {
                    width: squareSize,
                    height: squareSize,
                    backgroundColor: isSelected
                      ? SELECTED_SQUARE
                      : isHovered
                        ? HOVER_SQUARE
                        : isLight
                          ? LIGHT_SQUARE
                          : DARK_SQUARE,
                  },
                ];
                const squareContent = (
                  <>
                    {celebrationGlow?.square === square ? (
                      <ClassificationGlowOverlay
                        key={celebrationGlow.effectKey}
                        color={
                          CLASSIFICATION_BADGE_STYLES[celebrationGlow.classification].backgroundColor
                        }
                        squareSize={squareSize}
                        effectKey={celebrationGlow.effectKey}
                        onComplete={clearCelebrationGlow}
                      />
                    ) : null}

                    {isLegalMove && !isCapture && <View style={styles.moveDot} />}
                    {isLegalMove && isCapture && <View style={styles.captureRing} />}

                    {showPiece && (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.pieceContainer,
                          (isDraggingFromSquare || isEasterEggFromSquare) && styles.draggingPieceHidden,
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

                if (usePanResponderShell) {
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
              })}

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

              {moveSlide ? (
                <PieceMoveOverlay
                  key={moveSlide.effectKey}
                  from={moveSlide.from}
                  to={moveSlide.to}
                  piece={moveSlide.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  startTranslateX={moveSlide.startTranslateX}
                  startTranslateY={moveSlide.startTranslateY}
                  effectKey={moveSlide.effectKey}
                  onComplete={handleMoveSlideComplete}
                />
              ) : null}

              {illegalMoveShake ? (
                <PieceShakeOverlay
                  key={illegalMoveShake.effectKey}
                  square={illegalMoveShake.square}
                  piece={illegalMoveShake.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  effectKey={illegalMoveShake.effectKey}
                  onComplete={handleIllegalMoveShakeComplete}
                />
              ) : null}

              {easterEggAnimation && (
                <EasterEggMoveOverlay
                  key={easterEggAnimation.effectKey}
                  from={easterEggAnimation.from}
                  to={easterEggAnimation.to}
                  piece={easterEggAnimation.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  effectKey={easterEggAnimation.effectKey}
                  onComplete={handleEasterEggComplete}
                />
              )}

              {checkmateOverlay ? (
                <CheckmateOverlay
                  key={checkmateOverlay.effectKey}
                  matingSquare={checkmateOverlay.matingSquare}
                  winningKingSquare={checkmateOverlay.winningKingSquare}
                  losingKingSquare={checkmateOverlay.losingKingSquare}
                  squareSize={squareSize}
                  boardOrientation={boardOrientation}
                  effectKey={checkmateOverlay.effectKey}
                  onComplete={handleCheckmateOverlayComplete}
                />
              ) : null}

              {latestClassification && classificationBadgePosition && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.classificationBadgeHost,
                    {
                      left: classificationBadgeLeft,
                      top: classificationBadgeTop,
                      width: latestClassification.missedWin
                        ? classificationBadgeSize * 1.65
                        : classificationBadgeSize,
                      height: classificationBadgeSize,
                      flexDirection: 'row',
                      gap: 2,
                    },
                  ]}
                >
                  <MoveClassificationBadge
                    classification={latestClassification.classification}
                    size={classificationBadgeSize}
                  />
                  {latestClassification.missedWin ? (
                    <MoveClassificationBadge
                      classification="MissedWin"
                      size={Math.max(14, classificationBadgeSize * 0.78)}
                    />
                  ) : null}
                </View>
              )}

              {hint ? (
                <HintOverlay
                  from={hint.from}
                  to={hint.to}
                  squareSize={squareSize}
                  boardSize={boardSize}
                  boardOrientation={boardOrientation}
                  showArrow={hint.showArrow}
                />
              ) : null}

              {dragOverlay ? (
                <DragPieceOverlay
                  from={dragOverlay.from}
                  piece={dragOverlay.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  translateX={dragTranslateX}
                  translateY={dragTranslateY}
                />
              ) : null}
            </View>
          </View>

          <CapturedPiecesBar
            captures={bottomSideCaptures}
            captorColor={bottomSideColor}
            advantagePoints={bottomCaptureAdvantage}
            width={boardSize}
            pieceIconSize={capturedPieceIconSize}
          />

            <View style={[styles.fileNotationRow, { width: boardSize }]}>
              {fileLabels(boardOrientation).map((file) => (
                <Text key={file} style={[styles.fileNotation, { width: squareSize }]}>
                  {file}
                </Text>
              ))}
            </View>
            {openingLabel ? (
              <Text style={[styles.openingLabel, { width: boardSize }]} numberOfLines={2}>
                {openingLabel}
              </Text>
            ) : null}
        </View>

        <View
          style={[
            styles.rankNotationColumn,
            { width: RANK_NOTATION_WIDTH, height: boardSize },
          ]}
        >
          {rankLabels(boardOrientation).map((rank) => (
            <Text key={rank} style={[styles.rankNotation, { height: squareSize, lineHeight: squareSize }]}>
              {rank}
            </Text>
          ))}
        </View>
      </View>
      </View>

      <SafeAreaView style={chromeStyles.resetAnchor} pointerEvents="box-none">
        {moveHistoryLabel ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={chromeStyles.moveHistoryScroll}
            contentContainerStyle={chromeStyles.moveHistoryContent}
          >
            <Text style={chromeStyles.moveHistoryText}>{moveHistoryLabel}</Text>
          </ScrollView>
        ) : null}
        <View style={chromeStyles.bottomButtons}>
          <Pressable
            style={({ pressed }) => [
              chromeStyles.actionButton,
              hint != null && !hint.showArrow && chromeStyles.actionButtonHintActive,
              (!canRequestHint || hintLoading) && chromeStyles.actionButtonDisabled,
              pressed && canRequestHint && !hintLoading && chromeStyles.actionButtonPressed,
            ]}
            onPress={() => void requestHintDisplay(false)}
            disabled={!canRequestHint || hintLoading}
            accessibilityRole="button"
            accessibilityLabel="Show hint on origin square"
            accessibilityState={{ disabled: !canRequestHint || hintLoading }}
          >
            <Text
              style={[
                chromeStyles.actionButtonText,
                (!canRequestHint || hintLoading) && chromeStyles.actionButtonTextDisabled,
                hint != null && !hint.showArrow && chromeStyles.actionButtonHintText,
              ]}
            >
              Hint
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              chromeStyles.actionButton,
              hint?.showArrow && chromeStyles.actionButtonHintActive,
              (!canRequestHint || hintLoading) && chromeStyles.actionButtonDisabled,
              pressed && canRequestHint && !hintLoading && chromeStyles.actionButtonPressed,
            ]}
            onPress={() => void requestHintDisplay(true)}
            disabled={!canRequestHint || hintLoading}
            accessibilityRole="button"
            accessibilityLabel="Show hint with arrow"
            accessibilityState={{ disabled: !canRequestHint || hintLoading }}
          >
            <Text
              style={[
                chromeStyles.actionButtonText,
                (!canRequestHint || hintLoading) && chromeStyles.actionButtonTextDisabled,
                hint?.showArrow && chromeStyles.actionButtonHintText,
              ]}
            >
              Hintt
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              chromeStyles.actionButton,
              !canUndo && chromeStyles.actionButtonDisabled,
              pressed && canUndo && chromeStyles.actionButtonPressed,
            ]}
            onPress={undoMove}
            disabled={!canUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo last move"
            accessibilityState={{ disabled: !canUndo }}
          >
            <Text style={[chromeStyles.actionButtonText, !canUndo && chromeStyles.actionButtonTextDisabled]}>
              ← Undo
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [chromeStyles.actionButton, pressed && chromeStyles.actionButtonPressed]}
            onPress={() => openAccuracyReport(true)}
            accessibilityRole="button"
            accessibilityLabel="End game and show accuracy report"
          >
            <Text style={chromeStyles.actionButtonText}>End Game</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [chromeStyles.actionButton, pressed && chromeStyles.actionButtonPressed]}
            onPress={resetGame}
            accessibilityRole="button"
            accessibilityLabel="Reset game"
          >
            <Text style={chromeStyles.actionButtonText}>↺ Reset</Text>
          </Pressable>
          {onBack ? (
            <Pressable
              style={({ pressed }) => [chromeStyles.actionButton, pressed && chromeStyles.actionButtonPressed]}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Text style={chromeStyles.actionButtonText}>← Back</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      <AccuracyReport
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        moves={reportMoves}
        gameResult={describeGameResult(game, reportEndedEarly)}
        openingName={openingLabel}
      />
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
    paddingHorizontal: HORIZONTAL_PADDING,
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
    overflow: 'visible',
  },
  classificationBadgeHost: {
    position: 'absolute',
    zIndex: 12,
    elevation: 12,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'center',
  },
  boardColumn: {
    alignItems: 'center',
    flexShrink: 0,
  },
  rankNotationColumn: {
    justifyContent: 'flex-start',
    flexShrink: 0,
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
  openingLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'right',
    lineHeight: 15,
  },
  square: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
    zIndex: 2,
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
    zIndex: 20,
    elevation: 20,
  },
});

function createBoardChromeStyles(theme: AppTheme) {
  return StyleSheet.create({
    sideSelectorAnchor: {
      position: 'absolute',
      left: 0,
      top: 0,
      paddingLeft: 5,
      paddingTop: 5,
      zIndex: 20,
      elevation: 20,
    },
    sideSelectorRow: {
      flexDirection: 'row',
      gap: 8,
    },
    sideSelectorButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      backgroundColor: theme.surfaceBackground,
    },
    sideSelectorButtonActive: {
      borderColor: theme.sideSelectorActiveBorder,
      backgroundColor: theme.sideSelectorActiveBackground,
    },
    sideSelectorButtonPressed: {
      backgroundColor: theme.surfaceBackgroundPressed,
    },
    sideSelectorText: {
      color: theme.moveHistoryText,
      fontSize: 13,
      fontWeight: '600',
    },
    sideSelectorTextActive: {
      color: theme.textPrimary,
    },
    resetAnchor: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      paddingLeft: 5,
      paddingBottom: 5,
    },
    bottomButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      maxWidth: 360,
    },
    moveHistoryScroll: {
      maxWidth: 360,
      marginBottom: 8,
    },
    moveHistoryContent: {
      paddingRight: 8,
    },
    moveHistoryText: {
      color: theme.moveHistoryText,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    actionButton: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.actionButtonBorder,
      backgroundColor: theme.actionButtonBackground,
    },
    actionButtonPressed: {
      backgroundColor: theme.actionButtonBackgroundPressed,
    },
    actionButtonDisabled: {
      opacity: 0.38,
      borderColor: theme.actionButtonBorderDisabled,
      backgroundColor: theme.actionButtonBackgroundDisabled,
    },
    actionButtonText: {
      color: theme.actionButtonText,
      fontSize: 15,
      fontWeight: '600',
    },
    actionButtonTextDisabled: {
      color: theme.actionButtonTextDisabled,
    },
    actionButtonHintActive: {
      borderColor: theme.hintButtonBorder,
      backgroundColor: theme.hintButtonBackground,
      shadowColor: theme.hintButtonShadow,
      shadowOpacity: 0.45,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    actionButtonHintText: {
      color: theme.hintButtonText,
    },
  });
}
