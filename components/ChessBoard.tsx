import { Chess, DEFAULT_POSITION, Move, Square } from 'chess.js';
import type { Color, PieceSymbol } from 'chess.js';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BoardSquare from './BoardSquare';
import CapturedPiecesBar from './CapturedPiecesBar';
import AccuracyReport from './AccuracyReport';
import GameMenuButton from './GameMenuButton';
import ScrollLockButton from './ScrollLockButton';
import MoveHistoryList from './MoveHistoryList';
import CheckmateOverlay from './CheckmateOverlay';
import DragPieceOverlay from './DragPieceOverlay';
import EasterEggMoveOverlay from './EasterEggMoveOverlay';
import EvalBar from './EvalBar';
import PieceMoveOverlay from './PieceMoveOverlay';
import PieceShakeOverlay from './PieceShakeOverlay';
import HintOverlay from './HintOverlay';
import ActionLeadingIcon from './ActionLeadingIcon';
import MoveClassificationBadge, {
  CLASSIFICATION_BADGE_STYLES,
} from './MoveClassificationBadge';
import PromotionPicker, { PROMOTION_PICKER_SCALE } from './PromotionPicker';
import { useHoldRepeat } from '../hooks/useHoldRepeat';
import { historyNavIntervalMs } from '../lib/holdRepeat';
import { useMoveClassification, type ClassifiedMoveRecord, type LatestMoveClassification } from '../hooks/useMoveClassification';
import {
  useAppPreferences,
  useCheckmateAnimationEnabledRef,
  useMoveQualitySpinAnimationEnabledRef,
} from '../contexts/AppPreferencesContext';
import { useChessSound } from '../contexts/ChessSoundContext';
import {
  promotionPickerPosition,
  realIndicesFromVisual,
  squareFromPageCoords,
  squareToVisualPosition,
  toSquare,
  type BoardOrientation,
} from '../lib/boardOrientation';
import {
  dragTranslateFromPage,
  getPieceLandingPosition,
  normalizeBoardSize,
  pieceSizeFromSquare,
  squareSizeFromBoard,
} from '../lib/boardGeometry';
import {
  appendMove,
  createGameSession,
  goToIndex,
  isGameLineOver,
  movesThroughIndex,
  toFen,
  toPgn,
  truncateAndAppend,
  type GameSession,
} from '../lib/gameHistory';
import type { ActiveGameSnapshot } from '../lib/activeGameSnapshot';
import { alignClassifiedMovesToSans } from '../lib/classifiedMoves';
import { buildGameOutcome, describeGameResult, type GameOutcome } from '../lib/gameResult';
import {
  REPETITION_DRAW_WARNING_TEXT,
  shouldShowRepetitionDrawWarning,
} from '../lib/repetitionDrawWarning';
import { findKingSquare, winnerColorAfterCheckmate } from '../lib/kingSquare';
import {
  CAPTURE_ROW_HEIGHT,
  computeCapturedMaterialFromSans,
  visualBottomColor,
  visualTopColor,
} from '../lib/capturedPieces';
import { formatOpeningLabel, getOpeningBook } from '../lib/openingBook';
import { chooseBotMove, botColorForPlayer, botMoveUsesStockfish, waitForBotMoveRevealDelay, waitForNextFrame } from '../lib/botOpponent';
import { waitUntilPlayerMoveQualityVisible } from '../lib/playerClassificationGate';
import { isAnalysisCancelled } from '../lib/stockfishCancel';
import { parseUciMove } from '../lib/uciParse';
import { bestMoveArrowForReviewRecord } from '../lib/reviewBestMoveArrow';
import { reviewDisplayFenForPly } from '../lib/reviewBoardPosition';
import { moveSoundYieldsToBrilliant, replayMoveFromRecord } from '../lib/chessMoveSound';
import { reviewAutoplayDelayMs } from '../lib/reviewSettings';
import {
  liveEvalFromClassifiedRecord,
  NEUTRAL_POSITION_EVAL,
  type LivePositionEval,
} from '../lib/liveEval';
import { getBotImageSource, type Bot } from '../lib/bots';
import { HOME_MASCOT_SOURCE } from '../lib/preloadImages';
import {
  boardOrientationForColor,
  passAndPlaySideLabel,
  passAndPlayTurnLabel,
} from '../lib/passAndPlay';
import { SCREEN_BACK_BUTTON_LEFT, SCREEN_BACK_BUTTON_TOP } from './ScreenBackButton';
import { useStockfishEngine } from './StockfishWebViewEngine';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../theme';

const HORIZONTAL_PADDING = 8;
const EVAL_BAR_WIDTH = 24;
const EVAL_BAR_MARGIN = 8;
const BOARD_BORDER = 2;
/** Play-as-White/Black row below the status bar (anchor pad 5 + button ~35). */
const HEADER_ROW_HEIGHT = 40;
/** Always-reserved opening name slot: 2 lines at lineHeight 15. */
const OPENING_LABEL_SLOT_HEIGHT = 30;
/** bottomBar minHeight. */
const BOARD_CONTROLS_HEIGHT = 56;
/** Horizontal inset so side controls don't overlap the centered menu button. */
const BOTTOM_BAR_CENTER_RESERVE = 30;
/** Extra inset on free board where Hint + Ultra share the left cluster. */
const BOTTOM_BAR_CENTER_RESERVE_FREE = 38;
/** Leftover space above vs below the play block (2:1 keeps the board below center). */
const TOP_LEFTOVER_FLEX = 2;
const BOTTOM_LEFTOVER_FLEX = 1;
const HINT_DISPLAY_MS = 5000;
/** Min finger movement before live drag overlay mounts (matches drop/slide threshold). */
const DRAG_MOVEMENT_THRESHOLD_PX = 2;
/** Warn if Stockfish never reaches ready during a bot game (production-visible). */
const BOT_ENGINE_READY_WARN_MS = 25_000;
const PLAYER_PORTRAIT_SOURCE = HOME_MASCOT_SOURCE;

function showSaveConfirmation(title: string, message: string) {
  Alert.alert(title, message);
}

async function shareGameFile(params: {
  contents: string;
  formatLabel: string;
}) {
  try {
    await Clipboard.setStringAsync(params.contents);
    showSaveConfirmation('Copied', `${params.formatLabel} copied to clipboard.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showSaveConfirmation('Copy failed', message);
  }
}

function isViewingHistory(session: GameSession): boolean {
  return session.currentIndex < session.moves.length - 1;
}

function chessFromSession(session: GameSession): Chess {
  return new Chess(toFen(session));
}

function classificationBadgeFromRecord(
  record: ClassifiedMoveRecord,
): LatestMoveClassification | null {
  const parsed = parseUciMove(record.move);
  if (!parsed) {
    return null;
  }
  return {
    from: parsed.from,
    square: parsed.to,
    classification: record.classification,
    missedWin: record.missedWin,
  };
}

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
  fromDrag: boolean;
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
  completePanEnd: (
    from: Square,
    dropPageX: number,
    dropPageY: number,
    movedEnough: boolean,
    gesture: { dx: number; dy: number } | null,
  ) => void;
  clearDragVisual: () => void;
  canMoveFrom: (square: Square) => boolean;
  canHandleSquarePress: () => boolean;
  shouldClaimPieceSquarePan: (square: Square) => boolean;
  boardOrientation: BoardOrientation;
};

function setDragTranslateFromPage(
  from: Square,
  pageX: number,
  pageY: number,
  layout: BoardLayout,
  pieceSize: number,
  orientation: BoardOrientation,
  playerColor: Color,
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
    playerColor,
  );
  translateX.setValue(translate.x);
  translateY.setValue(translate.y);
  return translate;
}

function hasDragOffset(gesture: { dx: number; dy: number } | null): boolean {
  return (
    gesture != null &&
    (Math.abs(gesture.dx) > DRAG_MOVEMENT_THRESHOLD_PX ||
      Math.abs(gesture.dy) > DRAG_MOVEMENT_THRESHOLD_PX)
  );
}

function exceedsDragMovementThreshold(dx: number, dy: number): boolean {
  return (
    Math.abs(dx) > DRAG_MOVEMENT_THRESHOLD_PX || Math.abs(dy) > DRAG_MOVEMENT_THRESHOLD_PX
  );
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
  playerColor: Color,
): { x: number; y: number } {
  if (hasDragOffset(lastGesture)) {
    // PanResponder gestures use dx/dy; startMoveSlide expects x/y.
    return { x: lastGesture!.dx, y: lastGesture!.dy };
  }
  if (hasDragOffset(releaseGesture)) {
    return { x: releaseGesture!.dx, y: releaseGesture!.dy };
  }
  return dragTranslateFromPage(from, pageX, pageY, layout, squareSize, pieceSize, orientation, playerColor);
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

export type ChessBoardHandle = {
  resign: () => void;
  rematch: () => void;
  savePgn: () => void;
  saveFen: () => void;
  getActiveGameSnapshot: () => ActiveGameSnapshot | null;
  /** Snapshot for post-game evaluation/save even after the game has ended. */
  getFinishedGameSnapshot: () => ActiveGameSnapshot | null;
};

type ChessBoardProps = {
  bot?: Bot;
  gameMode?: 'free' | 'bot' | 'puzzle';
  initialActiveGameSnapshot?: ActiveGameSnapshot | null;
  /** True when restoring a finished game (checkmate, resign, draw) so it does not resume as live play. */
  initialGameFinished?: boolean;
  initialPassAndPlay?: boolean;
  onActiveGameSnapshotChange?: (snapshot: ActiveGameSnapshot | null) => void;
  onOpenFreeBoardModes?: () => void;
  onGameEnded?: (outcome: GameOutcome) => void;
  onAbortGame?: () => void;
  /** Extra bottom padding on move history while the post-game bar covers the screen. */
  historyScrollPaddingBottom?: number;
  reviewMode?: boolean;
  reviewMoves?: readonly string[];
  reviewFens?: readonly string[];
  reviewClassifiedMoves?: readonly ClassifiedMoveRecord[];
  reviewBestMoveArrow?: { from: Square; to: Square } | null;
  reviewPlayerColor?: 'w' | 'b';
  reviewShowBestMoveArrows?: boolean;
  reviewCurrentIndex?: number;
  onReviewPlyChange?: (plyIndex: number) => void;
  onSaveToMyGames?: () => void;
  /** When true with reviewMode, renders a compact board block for embedding in review screens. */
  reviewEmbedded?: boolean;
  /** Blocks review playback and analysis chrome until post-game evaluation is ready. */
  reviewPlaybackLocked?: boolean;
  onSaveReview?: () => void;
};

const ChessBoard = forwardRef<ChessBoardHandle, ChessBoardProps>(function ChessBoard(
  {
    bot,
    gameMode = 'free',
    initialActiveGameSnapshot = null,
    initialGameFinished = false,
    initialPassAndPlay = false,
    onActiveGameSnapshotChange,
    onOpenFreeBoardModes,
    onGameEnded,
    onAbortGame,
    historyScrollPaddingBottom = 0,
    reviewMode = false,
    reviewMoves = [],
    reviewFens = [],
    reviewClassifiedMoves = [],
    reviewBestMoveArrow = null,
    reviewPlayerColor = 'w',
    reviewShowBestMoveArrows = true,
    reviewCurrentIndex,
    onReviewPlyChange,
    onSaveToMyGames,
    reviewEmbedded = false,
    reviewPlaybackLocked = false,
    onSaveReview,
  },
  ref,
) {
  const theme = useTheme();
  const { preferences } = useAppPreferences();
  const playerDisplayName = preferences.playerName;
  const chromeStyles = useMemo(() => createBoardChromeStyles(theme), [theme]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const boardRowChrome =
    HORIZONTAL_PADDING * 2 +
    EVAL_BAR_WIDTH +
    EVAL_BAR_MARGIN +
    BOARD_BORDER;
  const maxBoardSizeByWidth = Math.max(0, Math.floor(windowWidth - boardRowChrome));
  const playChromeHeight =
    CAPTURE_ROW_HEIGHT * 2 +
    OPENING_LABEL_SLOT_HEIGHT +
    BOARD_CONTROLS_HEIGHT +
    BOARD_BORDER;
  const innerHeight = Math.max(
    0,
    windowHeight - (insets.top + HEADER_ROW_HEIGHT) - insets.bottom,
  );
  let boardSize = normalizeBoardSize(maxBoardSizeByWidth);
  let playStackHeight = playChromeHeight + boardSize;
  if (playStackHeight > innerHeight) {
    boardSize = normalizeBoardSize(Math.max(0, innerHeight - playChromeHeight));
    playStackHeight = playChromeHeight + boardSize;
  }
  const availableForSpacers = reviewEmbedded ? 0 : Math.max(0, innerHeight - playStackHeight);
  const topBannerMinHeight = reviewEmbedded
    ? 0
    : Math.round(
        availableForSpacers *
          TOP_LEFTOVER_FLEX /
          (TOP_LEFTOVER_FLEX + BOTTOM_LEFTOVER_FLEX),
      );
  const boardRenderedHeight = boardSize + BOARD_BORDER;
  const squareSize = squareSizeFromBoard(boardSize);
  const pieceSize = pieceSizeFromSquare(squareSize);

  const gameRef = useRef(new Chess(DEFAULT_POSITION));
  const gameSessionRef = useRef(createGameSession(bot?.name ?? 'Opponent'));
  const boardLayoutRef = useRef<BoardLayout>({ x: 0, y: 0, size: 0 });
  const wrapperOffsetRef = useRef({ x: 0, y: 0 });
  const boardRef = useRef<View>(null);
  const wrapperRef = useRef<View>(null);
  const historyScrollRef = useRef<ScrollView>(null);
  const interactionHandlersRef = useRef<InteractionHandlers>({
    gameOver: false,
    turn: 'w',
    pieceSize: 32,
    selectSquare: () => undefined,
    clearSelection: () => undefined,
    finishDrag: () => undefined,
    handleSquarePress: () => undefined,
    completePanEnd: () => undefined,
    clearDragVisual: () => undefined,
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
  const animateCommittedMoveRef = useRef<(move: Move) => void>(() => undefined);
  const moveSlideEffectKeyRef = useRef(0);
  const illegalMoveShakeRef = useRef<IllegalMoveShake | null>(null);
  const illegalMoveShakeEffectKeyRef = useRef(0);

  const [boardVersion, setBoardVersion] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<BoardOrientation>('white');
  const [playerColor, setPlayerColor] = useState<Color>('w');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const [moveSlide, setMoveSlide] = useState<MoveSlideAnimation | null>(null);
  const [illegalMoveShake, setIllegalMoveShake] = useState<IllegalMoveShake | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportEndedEarly, setReportEndedEarly] = useState(false);
  const [reportResultOverride, setReportResultOverride] = useState<string | null>(null);
  const [userEndedGame, setUserEndedGame] = useState(false);
  const [botPlayLocked, setBotPlayLocked] = useState(false);
  const [reportMoves, setReportMoves] = useState<ClassifiedMoveRecord[]>([]);
  const [openingLabel, setOpeningLabel] = useState<string | null>(null);
  const [hint, setHint] = useState<HintDisplay | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [celebrationGlow, setCelebrationGlow] = useState<CelebrationGlow | null>(null);
  const [easterEggAnimation, setEasterEggAnimation] = useState<EasterEggAnimation | null>(null);
  const [checkmateOverlay, setCheckmateOverlay] = useState<CheckmateOverlayState | null>(null);
  const [passAndPlayEnabled, setPassAndPlayEnabled] = useState(false);
  const autoReportShownRef = useRef(false);
  const gameEndedNotifiedRef = useRef(false);
  const onGameEndedRef = useRef(onGameEnded);
  onGameEndedRef.current = onGameEnded;
  const onActiveGameSnapshotChangeRef = useRef(onActiveGameSnapshotChange);
  onActiveGameSnapshotChangeRef.current = onActiveGameSnapshotChange;
  const buildGameSnapshotFromSessionRef = useRef<() => ActiveGameSnapshot | null>(() => null);
  const initialSnapshotAppliedRef = useRef(false);
  const botTurnScheduledRef = useRef<string | null>(null);
  const botActionEpochRef = useRef(0);
  const botTurnBlockCountRef = useRef<{ fen: string; count: number } | null>(null);
  const [botTurnRetryToken, setBotTurnRetryToken] = useState(0);
  const playerMoveClassificationRef = useRef(Promise.resolve());
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
  const playerColorRef = useRef<Color>('w');
  playerColorRef.current = playerColor;
  easterEggAnimationRef.current = easterEggAnimation;
  checkmateOverlayRef.current = checkmateOverlay;

  const {
    onMovePlayed,
    syncAnalysisToSession,
    trimAnalysisToPlyCount,
    restoreClassifiedMoves,
    resetClassification,
    latestClassification,
    positionEval,
    classifiedMovesRef,
    isAnalysisIdle,
    isEngineReady,
    enqueueEngineTask,
    requestBestMove,
    getCachedPositionAnalysis,
  } = useMoveClassification({ enabled: !reviewMode });
  const { sendCommand, addLineListener, registerAnalysisCancel } = useStockfishEngine();
  const { playMoveSound, playBrilliantSound, playIllegalSound } = useChessSound();
  const checkmateAnimationEnabledRef = useCheckmateAnimationEnabledRef();
  const moveQualitySpinAnimationEnabledRef = useMoveQualitySpinAnimationEnabledRef();

  const isBotGame = bot != null && !reviewMode;
  const isFreeBoard = gameMode === 'free' && !reviewMode;
  const isPassAndPlay = isFreeBoard && passAndPlayEnabled;
  const reviewInitializedRef = useRef(false);
  const reviewPlySoundRef = useRef<number | null>(null);
  const [reviewAutoplay, setReviewAutoplay] = useState(false);
  const [scrollUnlocked, setScrollUnlocked] = useState(false);
  const onReviewPlyChangeRef = useRef(onReviewPlyChange);
  onReviewPlyChangeRef.current = onReviewPlyChange;
  const botColor: Color = botColorForPlayer(playerColor);

  const trackMoveClassification = useCallback(
    (move: Move, fenBefore: string) => {
      const pending = onMovePlayed(move, fenBefore);
      void pending.then(() => {
        onActiveGameSnapshotChangeRef.current?.(buildGameSnapshotFromSessionRef.current());
      });
      if (isBotGame && move.color === playerColorRef.current) {
        playerMoveClassificationRef.current = pending;
      }
    },
    [isBotGame, onMovePlayed],
  );

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
      if (isViewingHistory(gameSessionRef.current)) {
        return;
      }
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
  const session = gameSessionRef.current;
  const viewingHistory = isViewingHistory(session);
  const reviewPlyIndex =
    reviewMode && reviewCurrentIndex != null ? reviewCurrentIndex : null;
  const canGoBack = reviewMode
    ? !reviewPlaybackLocked && (reviewPlyIndex ?? -1) > -1
    : session.currentIndex > -1;
  const canGoForward = reviewMode
    ? !reviewPlaybackLocked && (reviewPlyIndex ?? -1) < session.moves.length - 1
    : viewingHistory;
  const reviewRecord =
    reviewMode && reviewPlyIndex != null && reviewPlyIndex >= 0
      ? reviewClassifiedMoves[reviewPlyIndex]
      : undefined;
  const viewedRecord =
    session.currentIndex >= 0 ? classifiedMovesRef.current[session.currentIndex] : undefined;
  const viewedClassification = viewedRecord
    ? classificationBadgeFromRecord(viewedRecord)
    : null;
  const activeRecord = reviewMode ? reviewRecord : viewedRecord;
  const displayedClassification = reviewMode
    ? reviewPlaybackLocked
      ? null
      : activeRecord
      ? classificationBadgeFromRecord(activeRecord)
      : null
    : viewedClassification ?? (!viewingHistory ? latestClassification : null);
  const syncedPositionEval =
    isAnalysisIdle &&
    !positionEval.isNeutral &&
    getCachedPositionAnalysis()?.fen === toFen(session)
      ? positionEval
      : null;
  const reviewDisplayArrow =
    reviewMode && !reviewPlaybackLocked && activeRecord
      ? bestMoveArrowForReviewRecord(activeRecord, activeRecord.fenBefore)
      : reviewBestMoveArrow;
  const displayedEval = reviewMode
    ? reviewPlyIndex == null || reviewPlyIndex < 0
      ? NEUTRAL_POSITION_EVAL
      : syncedPositionEval ?? (activeRecord ? liveEvalFromClassifiedRecord(activeRecord) : positionEval)
    : viewingHistory
      ? session.currentIndex < 0
        ? NEUTRAL_POSITION_EVAL
        : syncedPositionEval ??
          (viewedRecord ? liveEvalFromClassifiedRecord(viewedRecord) : positionEval)
      : positionEval;
  const board = game.board();
  const gameOver = game.isGameOver();
  const effectiveGameOver = gameOver || userEndedGame;
  const lineIsOver = isGameLineOver(session.moves);
  const playSealed = userEndedGame || lineIsOver;
  const piecesLocked = botPlayLocked || playSealed || (effectiveGameOver && !isFreeBoard);
  const turn = game.turn();
  const moveHistory = game.history();
  const canResign = !viewingHistory && !effectiveGameOver && moveHistory.length > 0;

  const capturedMaterial = useMemo(
    () => computeCapturedMaterialFromSans(movesThroughIndex(session)),
    [boardVersion, session],
  );
  const showRepetitionDrawWarning = useMemo(
    () => !effectiveGameOver && shouldShowRepetitionDrawWarning(game),
    [effectiveGameOver, game, boardVersion],
  );

  const topSideColor = visualTopColor(boardOrientation);
  const bottomSideColor = visualBottomColor(boardOrientation);
  const capturedPieceIconSize = Math.max(18, Math.min(26, squareSize * 0.32));
  const playerPortraitSource = PLAYER_PORTRAIT_SOURCE;
  const opponentPortraitSource = bot
    ? getBotImageSource(bot, theme.scheme)
    : playerPortraitSource;
  const topPortraitSource =
    topSideColor === playerColor ? playerPortraitSource : opponentPortraitSource;
  const bottomPortraitSource =
    bottomSideColor === playerColor ? playerPortraitSource : opponentPortraitSource;
  const topPortraitLabel = isPassAndPlay
    ? passAndPlaySideLabel(topSideColor)
    : topSideColor === playerColor
      ? playerDisplayName
      : bot?.name ?? 'Opponent';
  const bottomPortraitLabel = isPassAndPlay
    ? passAndPlaySideLabel(bottomSideColor)
    : bottomSideColor === playerColor
      ? playerDisplayName
      : bot?.name ?? 'Opponent';
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

  const legalMoves: Move[] = useMemo(() => {
    if (!selectedSquare || effectiveGameOver || pendingPromotion) {
      return [];
    }
    return game.moves({ square: selectedSquare, verbose: true });
  }, [effectiveGameOver, game, pendingPromotion, selectedSquare, boardVersion]);

  const legalMoveSquares = useMemo(
    () => new Set(legalMoves.map((move) => move.to)),
    [legalMoves],
  );
  const captureSquares = useMemo(
    () => new Set(legalMoves.filter((move) => move.isCapture()).map((move) => move.to)),
    [legalMoves],
  );

  const canRequestHint =
    !effectiveGameOver &&
    !pendingPromotion &&
    !isPassAndPlay &&
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
        const uci = await requestBestMove(gameRef.current.fen(), { forceRefresh: true });
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

  const clearBrilliantGreatEffects = useCallback(() => {
    clearCelebrationGlow();
    clearMoveQualitySpinAnimation();
  }, [clearCelebrationGlow, clearMoveQualitySpinAnimation]);

  const triggerBrilliantGreatEffects = useCallback(
    (from: Square, to: Square, classification: 'Brilliant' | 'Great'): boolean => {
      if (classification === 'Brilliant') {
        setCelebrationGlow(null);
        return false;
      }

      celebrationGlowKeyRef.current += 1;
      setCelebrationGlow({
        square: to,
        classification,
        effectKey: celebrationGlowKeyRef.current,
      });

      if (!moveQualitySpinAnimationEnabledRef.current) {
        return false;
      }

      const piece = gameRef.current.get(to);
      if (!piece) {
        return false;
      }

      if (moveSlideRef.current) {
        moveSlideRef.current = null;
        setMoveSlide(null);
      }

      easterEggEffectKeyRef.current += 1;
      setEasterEggAnimation({
        from,
        to,
        piece: { color: piece.color, type: piece.type },
        effectKey: easterEggEffectKeyRef.current,
      });
      return true;
    },
    [],
  );

  const deferredMoveSoundRef = useRef<{
    move: Move;
    fen: string;
    perspective: Color;
  } | null>(null);

  const flushDeferredMoveSound = useCallback(() => {
    const pending = deferredMoveSoundRef.current;
    if (!pending) {
      return;
    }
    deferredMoveSoundRef.current = null;
    playMoveSound(pending.move, new Chess(pending.fen), pending.perspective);
  }, [playMoveSound]);

  useEffect(() => {
    if (!latestClassification) {
      return;
    }

    const { classification, square } = latestClassification;
    const pending = deferredMoveSoundRef.current;
    const pendingMatches = pending?.move.to === square;

    if (classification === 'Brilliant' && pendingMatches) {
      deferredMoveSoundRef.current = null;
      playBrilliantSound();
    } else if (pendingMatches) {
      flushDeferredMoveSound();
    } else if (classification === 'Brilliant') {
      playBrilliantSound();
    }

    if (classification !== 'Brilliant' && classification !== 'Great') {
      return;
    }

    triggerBrilliantGreatEffects(latestClassification.from, square, classification);
  }, [flushDeferredMoveSound, latestClassification, playBrilliantSound, triggerBrilliantGreatEffects]);

  const notifyMoveSound = useCallback(
    (move: Move) => {
      const soundPerspective = isPassAndPlay ? move.color : playerColor;
      const game = gameRef.current;
      if (moveSoundYieldsToBrilliant(move, game)) {
        flushDeferredMoveSound();
        deferredMoveSoundRef.current = {
          move,
          fen: game.fen(),
          perspective: soundPerspective,
        };
        return;
      }
      flushDeferredMoveSound();
      playMoveSound(move, game, soundPerspective);
    },
    [flushDeferredMoveSound, isPassAndPlay, playMoveSound, playerColor],
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

  const startDragOverlayIfNeededRef = useRef<(square: Square) => void>(() => undefined);

  const startDragOverlayIfNeeded = useCallback((square: Square) => {
    if (dragOverlayRef.current?.from === square) {
      return;
    }

    const picked = gameRef.current.get(square);
    if (!picked) {
      return;
    }

    const overlay = {
      from: square,
      piece: { color: picked.color, type: picked.type },
    };
    dragOverlayRef.current = overlay;
    setDragOverlay(overlay);
  }, []);

  startDragOverlayIfNeededRef.current = startDragOverlayIfNeeded;

  const clearDragSession = useCallback(() => {
    clearDragVisual();
    dragTranslateX.setValue(0);
    dragTranslateY.setValue(0);
    setMoveSlide(null);
  }, [clearDragVisual, dragTranslateX, dragTranslateY]);

  const recordSessionMove = useCallback((move: Move) => {
    const session = gameSessionRef.current;
    const branching = isViewingHistory(session);

    if (branching) {
      trimAnalysisToPlyCount(session.currentIndex + 1);
      botActionEpochRef.current += 1;
      botTurnScheduledRef.current = null;
      botTurnBlockCountRef.current = null;
    }

    gameSessionRef.current = branching
      ? truncateAndAppend(session, move.san, move.after)
      : appendMove(session, move.san, move.after);
  }, [trimAnalysisToPlyCount]);

  const buildGameSnapshotFromSession = useCallback((): ActiveGameSnapshot | null => {
    const session = gameSessionRef.current;
    if (session.moves.length === 0) {
      return null;
    }

    const classifiedMoves = alignClassifiedMovesToSans(
      classifiedMovesRef.current,
      session.moves,
    );

    return {
      mode: isBotGame ? 'bot' : 'free',
      botId: bot?.id,
      session: {
        ...session,
        moves: [...session.moves],
        fens: [...session.fens],
      },
      boardOrientation,
      playerColor,
      passAndPlayEnabled,
      savedAt: Date.now(),
      finished: effectiveGameOver,
      ...(classifiedMoves.length > 0
        ? { classifiedMoves: classifiedMoves.map((record) => ({ ...record })) }
        : {}),
    };
  }, [boardOrientation, bot?.id, effectiveGameOver, isBotGame, passAndPlayEnabled, playerColor]);
  buildGameSnapshotFromSessionRef.current = buildGameSnapshotFromSession;

  const buildActiveGameSnapshot = useCallback((): ActiveGameSnapshot | null => {
    return buildGameSnapshotFromSession();
  }, [buildGameSnapshotFromSession]);

  const notifyActiveGameSnapshotChange = useCallback(() => {
    onActiveGameSnapshotChangeRef.current?.(buildActiveGameSnapshot());
  }, [buildActiveGameSnapshot]);

  const resetGame = useCallback(() => {
    gameRef.current.reset();
    gameSessionRef.current = createGameSession(bot?.name ?? 'Opponent');
    panRespondersRef.current = {};
    setSelectedSquare(null);
    clearDragSession();
    setIllegalMoveShake(null);
    setPendingPromotion(null);
    setReportVisible(false);
    setReportEndedEarly(false);
    setReportResultOverride(null);
    setUserEndedGame(false);
    setBotPlayLocked(false);
    setReportMoves([]);
    autoReportShownRef.current = false;
    gameEndedNotifiedRef.current = false;
    botTurnScheduledRef.current = null;
    botTurnBlockCountRef.current = null;
    matchedOpeningRef.current = null;
    setOpeningLabel(null);
    hintRequestRef.current += 1;
    clearHint();
    clearCelebrationGlow();
    clearMoveQualitySpinAnimation();
    setCheckmateOverlay(null);
    setScrollUnlocked(false);
    resetClassification();
    refreshBoard();
    onActiveGameSnapshotChangeRef.current?.(null);
  }, [bot, clearCelebrationGlow, clearDragSession, clearHint, clearMoveQualitySpinAnimation, refreshBoard, resetClassification]);

  const applyRestoredSnapshot = useCallback((snapshot: ActiveGameSnapshot, finished = false) => {
    botActionEpochRef.current += 1;
    botTurnScheduledRef.current = null;
    botTurnBlockCountRef.current = null;
    hintRequestRef.current += 1;
    gameSessionRef.current = {
      ...snapshot.session,
      moves: [...snapshot.session.moves],
      fens: [...snapshot.session.fens],
    };
    gameRef.current = chessFromSession(gameSessionRef.current);
    const restoredIsOver = gameRef.current.isGameOver();
    setBoardOrientation(snapshot.boardOrientation);
    setPlayerColor(snapshot.playerColor);
    setPassAndPlayEnabled(snapshot.passAndPlayEnabled);
    setSelectedSquare(null);
    clearDragSession();
    setIllegalMoveShake(null);
    setPendingPromotion(null);
    setReportVisible(false);
    setReportEndedEarly(false);
    setReportResultOverride(null);
    setUserEndedGame(finished && !restoredIsOver);
    setBotPlayLocked(finished && snapshot.mode === 'bot');
    setReportMoves([]);
    autoReportShownRef.current = true;
    gameEndedNotifiedRef.current = finished || restoredIsOver;
    matchedOpeningRef.current = null;
    setOpeningLabel(null);
    clearHint();
    clearCelebrationGlow();
    clearMoveQualitySpinAnimation();
    setCheckmateOverlay(null);
    setScrollUnlocked(false);
    restoreClassifiedMoves(snapshot.classifiedMoves ?? []);
    syncAnalysisToSession(gameSessionRef.current);
    panRespondersRef.current = {};
    refreshBoard();
  }, [
    clearCelebrationGlow,
    clearDragSession,
    clearHint,
    clearMoveQualitySpinAnimation,
    refreshBoard,
    restoreClassifiedMoves,
    syncAnalysisToSession,
  ]);

  useEffect(() => {
    setScrollUnlocked(false);
  }, []);

  useEffect(() => {
    if (!initialActiveGameSnapshot || initialSnapshotAppliedRef.current) {
      return;
    }

    initialSnapshotAppliedRef.current = true;
    applyRestoredSnapshot(initialActiveGameSnapshot, initialGameFinished);
  }, [applyRestoredSnapshot, initialActiveGameSnapshot, initialGameFinished]);

  const applySessionView = useCallback((next: GameSession) => {
    botActionEpochRef.current += 1;
    botTurnScheduledRef.current = null;
    botTurnBlockCountRef.current = null;
    hintRequestRef.current += 1;
    gameSessionRef.current = next;
    gameRef.current = chessFromSession(next);
    syncAnalysisToSession(next);
    panRespondersRef.current = {};
    setSelectedSquare(null);
    clearDragSession();
    setIllegalMoveShake(null);
    setPendingPromotion(null);
    clearHint();
    clearCelebrationGlow();
    refreshBoard();
  }, [clearCelebrationGlow, clearDragSession, clearHint, refreshBoard, syncAnalysisToSession]);

  const navigateToIndex = useCallback(
    (plyIndex: number) => {
      const next = goToIndex(gameSessionRef.current, plyIndex);
      if (!next) {
        return;
      }
      applySessionView(next);
    },
    [applySessionView],
  );

  const applyReviewPlyView = useCallback(
    (plyIndex: number) => {
      botActionEpochRef.current += 1;
      botTurnScheduledRef.current = null;
      botTurnBlockCountRef.current = null;
      hintRequestRef.current += 1;
      const session = gameSessionRef.current;

      if (plyIndex < 0) {
        gameRef.current = new Chess(DEFAULT_POSITION);
        gameSessionRef.current = { ...session, currentIndex: -1 };
      } else {
        const record = reviewClassifiedMoves[plyIndex];
        const fenAfter = reviewDisplayFenForPly(plyIndex, reviewFens, record);
        gameRef.current = new Chess(fenAfter);
        gameSessionRef.current = { ...session, currentIndex: plyIndex };
      }

      syncAnalysisToSession(gameSessionRef.current);
      panRespondersRef.current = {};
      setSelectedSquare(null);
      clearDragSession();
      setIllegalMoveShake(null);
      setPendingPromotion(null);
      clearHint();
      clearBrilliantGreatEffects();

      const previousPly = reviewPlySoundRef.current ?? -1;
      reviewPlySoundRef.current = plyIndex;

      if (plyIndex >= 0 && !reviewPlaybackLocked) {
        const record = reviewClassifiedMoves[plyIndex];
        const badge = record ? classificationBadgeFromRecord(record) : null;
        if (plyIndex > previousPly && record) {
          if (record.classification === 'Brilliant') {
            playBrilliantSound();
          } else {
            const replayed = replayMoveFromRecord(record);
            if (replayed) {
              playMoveSound(replayed.move, replayed.gameAfterMove, reviewPlayerColor);
            }
          }
        }

        if (
          badge &&
          (badge.classification === 'Brilliant' || badge.classification === 'Great')
        ) {
          triggerBrilliantGreatEffects(badge.from, badge.square, badge.classification);
        }
      }

      refreshBoard();
    },
    [
      clearBrilliantGreatEffects,
      clearDragSession,
      clearHint,
      playBrilliantSound,
      playMoveSound,
      refreshBoard,
      reviewClassifiedMoves,
      reviewFens,
      reviewPlaybackLocked,
      reviewPlayerColor,
      syncAnalysisToSession,
      triggerBrilliantGreatEffects,
    ],
  );

  const stopReviewAutoplay = useCallback(() => {
    setReviewAutoplay(false);
  }, []);

  const navigateBack = useCallback(() => {
    if (reviewMode) {
      if (reviewPlaybackLocked) {
        return;
      }
      stopReviewAutoplay();
      const ply = (reviewCurrentIndex ?? -1) - 1;
      if (ply >= -1) {
        onReviewPlyChangeRef.current?.(ply);
      }
      return;
    }
    navigateToIndex(gameSessionRef.current.currentIndex - 1);
  }, [navigateToIndex, reviewCurrentIndex, reviewMode, reviewPlaybackLocked, stopReviewAutoplay]);

  const navigateForward = useCallback(() => {
    if (reviewMode) {
      if (reviewPlaybackLocked) {
        return;
      }
      stopReviewAutoplay();
      const maxPly = gameSessionRef.current.moves.length - 1;
      const ply = (reviewCurrentIndex ?? -1) + 1;
      if (ply <= maxPly) {
        onReviewPlyChangeRef.current?.(ply);
      }
      return;
    }
    navigateToIndex(gameSessionRef.current.currentIndex + 1);
  }, [navigateToIndex, reviewCurrentIndex, reviewMode, reviewPlaybackLocked, stopReviewAutoplay]);

  const holdBack = useHoldRepeat(navigateBack, canGoBack, {
    singleIntervalMs: historyNavIntervalMs(preferences.historyHoldSpeed),
    doubleIntervalMs: historyNavIntervalMs(preferences.historyDoubleHoldSpeed),
  });
  const holdForward = useHoldRepeat(navigateForward, canGoForward, {
    singleIntervalMs: historyNavIntervalMs(preferences.historyHoldSpeed),
    doubleIntervalMs: historyNavIntervalMs(preferences.historyDoubleHoldSpeed),
  });

  const jumpToPly = useCallback(
    (plyIndex: number) => {
      if (reviewMode) {
        if (reviewPlaybackLocked) {
          return;
        }
        stopReviewAutoplay();
        onReviewPlyChangeRef.current?.(plyIndex);
        return;
      }
      navigateToIndex(plyIndex);
    },
    [navigateToIndex, reviewMode, reviewPlaybackLocked, stopReviewAutoplay],
  );

  const jumpToReviewStart = useCallback(() => {
    jumpToPly(-1);
  }, [jumpToPly]);

  const jumpToReviewEnd = useCallback(() => {
    if (reviewMoves.length === 0) {
      return;
    }
    jumpToPly(reviewMoves.length - 1);
  }, [jumpToPly, reviewMoves.length]);

  const canGoToReviewStart =
    reviewMode && !reviewPlaybackLocked && (reviewCurrentIndex ?? -1) > -1;
  const canGoToReviewEnd =
    reviewMode &&
    !reviewPlaybackLocked &&
    reviewMoves.length > 0 &&
    (reviewCurrentIndex ?? -1) < reviewMoves.length - 1;

  const reviewAtFinalPly =
    reviewMode &&
    reviewMoves.length > 0 &&
    (reviewCurrentIndex ?? -1) >= reviewMoves.length - 1;
  const reviewPlayDisabled =
    reviewPlaybackLocked ||
    reviewMoves.length === 0 ||
    (reviewAtFinalPly && !reviewAutoplay);

  const toggleReviewAutoplay = useCallback(() => {
    if (reviewPlaybackLocked) {
      stopReviewAutoplay();
      return;
    }
    if (reviewAutoplay) {
      stopReviewAutoplay();
      return;
    }
    if (reviewMoves.length === 0) {
      return;
    }
    const currentPly = reviewCurrentIndex ?? -1;
    if (currentPly >= reviewMoves.length - 1) {
      return;
    }
    setReviewAutoplay(true);
  }, [reviewAutoplay, reviewCurrentIndex, reviewMoves.length, reviewPlaybackLocked, stopReviewAutoplay]);

  const sharePgn = useCallback(async () => {
    await shareGameFile({
      contents: toPgn(gameSessionRef.current),
      formatLabel: 'PGN',
    });
  }, []);

  const shareFen = useCallback(async () => {
    await shareGameFile({
      contents: toFen(gameSessionRef.current),
      formatLabel: 'FEN',
    });
  }, []);

  const promptSaveGame = useCallback(() => {
    Alert.alert('Save Game', 'Choose a format', [
      ...(onSaveToMyGames
        ? [{ text: 'Save to My Games', onPress: onSaveToMyGames }]
        : []),
      { text: 'Save as PGN', onPress: () => void sharePgn() },
      { text: 'Save as FEN', onPress: () => void shareFen() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [onSaveToMyGames, shareFen, sharePgn]);

  const notifyGameEndedOnce = useCallback((outcome: GameOutcome) => {
    if (gameEndedNotifiedRef.current) {
      return;
    }
    gameEndedNotifiedRef.current = true;
    if (isBotGame) {
      setBotPlayLocked(true);
    }
    const snapshot = buildGameSnapshotFromSession();
    if (snapshot) {
      onActiveGameSnapshotChangeRef.current?.({ ...snapshot, finished: true });
    }
    onGameEndedRef.current?.(outcome);
  }, [buildGameSnapshotFromSession, isBotGame]);

  const tryOpenAutoReport = useCallback(() => {
    if (checkmateOverlayRef.current) {
      return;
    }
    if (gameOver) {
      notifyGameEndedOnce(buildGameOutcome(gameRef.current));
    }
  }, [gameOver, notifyGameEndedOnce]);

  const openAccuracyReport = useCallback((endedEarly: boolean, resultOverride?: string) => {
    if (classifiedMovesRef.current.length === 0) {
      return;
    }
    setReportMoves([...classifiedMovesRef.current]);
    setReportEndedEarly(endedEarly);
    setReportResultOverride(resultOverride ?? null);
    setReportVisible(true);
  }, [classifiedMovesRef]);

  const flipBoard = useCallback(() => {
    setBoardOrientation((orientation) => (orientation === 'white' ? 'black' : 'white'));
  }, []);

  const orientBoardForPassAndPlay = useCallback((sideToMove: Color) => {
    setPlayerColor(sideToMove);
    setBoardOrientation(boardOrientationForColor(sideToMove));
  }, []);

  const enablePassAndPlay = useCallback(() => {
    clearHint();
    setPassAndPlayEnabled(true);
    orientBoardForPassAndPlay(gameRef.current.turn());
  }, [clearHint, orientBoardForPassAndPlay]);

  useEffect(() => {
    if (!initialPassAndPlay || !isFreeBoard || passAndPlayEnabled) {
      return;
    }

    enablePassAndPlay();
  }, [enablePassAndPlay, initialPassAndPlay, isFreeBoard, passAndPlayEnabled]);

  const reviewSessionKey = reviewMode
    ? `${reviewMoves.join('|')}::${reviewFens.join('|')}::${reviewPlayerColor}`
    : '';
  const reviewSessionKeyRef = useRef('');

  useEffect(() => {
    if (!reviewMode) {
      reviewSessionKeyRef.current = '';
      reviewInitializedRef.current = false;
      reviewPlySoundRef.current = null;
      return;
    }

    if (reviewSessionKeyRef.current === reviewSessionKey && reviewInitializedRef.current) {
      return;
    }

    reviewSessionKeyRef.current = reviewSessionKey;
    reviewInitializedRef.current = true;
    reviewPlySoundRef.current = null;
    gameSessionRef.current = {
      moves: [...reviewMoves],
      fens: [...reviewFens],
      currentIndex: reviewMoves.length > 0 ? -1 : reviewFens.length > 0 ? 0 : -1,
      opponent: 'Review',
      startedAt: Date.now(),
    };
    setPlayerColor(reviewPlayerColor);
    setBoardOrientation(boardOrientationForColor(reviewPlayerColor));
    panRespondersRef.current = {};
    setReviewAutoplay(false);
  }, [reviewFens, reviewMode, reviewMoves, reviewPlayerColor, reviewSessionKey]);

  useEffect(() => {
    if (!reviewMode || reviewCurrentIndex == null) {
      return;
    }

    applyReviewPlyView(reviewCurrentIndex);
  }, [applyReviewPlyView, reviewCurrentIndex, reviewMode]);

  useEffect(() => {
    if (!reviewMode || !reviewAutoplay || reviewPlaybackLocked) {
      return;
    }

    const maxPly = reviewMoves.length - 1;
    const currentPly = reviewCurrentIndex ?? -1;
    if (currentPly >= maxPly) {
      setReviewAutoplay(false);
      return;
    }

    const timer = setTimeout(() => {
      onReviewPlyChangeRef.current?.(currentPly + 1);
    }, reviewAutoplayDelayMs(preferences.reviewPlaybackSpeed));

    return () => clearTimeout(timer);
  }, [
    preferences.reviewPlaybackSpeed,
    reviewAutoplay,
    reviewCurrentIndex,
    reviewMode,
    reviewMoves.length,
    reviewPlaybackLocked,
  ]);

  useEffect(() => {
    if (reviewPlaybackLocked) {
      setReviewAutoplay(false);
    }
  }, [reviewPlaybackLocked]);

  useEffect(() => {
    if (reviewMode) {
      return;
    }
    setReviewAutoplay(false);
  }, [reviewMode]);

  const disablePassAndPlay = useCallback(() => {
    clearHint();
    setPassAndPlayEnabled(false);
  }, [clearHint]);

  const resignGame = useCallback(() => {
    if (gameEndedNotifiedRef.current) {
      return;
    }
    setUserEndedGame(true);
    const resignedColor = isPassAndPlay ? gameRef.current.turn() : playerColorRef.current;
    notifyGameEndedOnce(buildGameOutcome(gameRef.current, { resignedColor }));
  }, [isPassAndPlay, notifyGameEndedOnce]);

  useImperativeHandle(
    ref,
    () => ({
      resign: resignGame,
      rematch: resetGame,
      savePgn: () => {
        void sharePgn();
      },
      saveFen: () => {
        void shareFen();
      },
      getActiveGameSnapshot: buildActiveGameSnapshot,
      getFinishedGameSnapshot: buildGameSnapshotFromSession,
    }),
    [buildActiveGameSnapshot, buildGameSnapshotFromSession, resignGame, resetGame, shareFen, sharePgn],
  );

  const confirmResign = useCallback(() => {
    Alert.alert('Resign', 'Are you sure you want to resign?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resign', style: 'destructive', onPress: resignGame },
    ]);
  }, [resignGame]);

  const confirmAbortGame = useCallback(() => {
    if (!onAbortGame) return;
    Alert.alert('Abort game', 'Are you sure you want to abort?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: onAbortGame },
    ]);
  }, [onAbortGame]);

  const handleCheckmateOverlayComplete = useCallback(() => {
    setCheckmateOverlay(null);
    notifyGameEndedOnce(buildGameOutcome(gameRef.current));
  }, [notifyGameEndedOnce]);

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
    panRespondersRef.current = {};
    setSelectedSquare(null);
    setHoverSquare(null);
  }, [boardOrientation, playerColor]);

  useEffect(() => {
    if (!isPassAndPlay || effectiveGameOver) {
      return;
    }
    orientBoardForPassAndPlay(turn);
  }, [effectiveGameOver, isPassAndPlay, orientBoardForPassAndPlay, turn, boardVersion]);

  useEffect(() => {
    if (!isBotGame || !bot || effectiveGameOver || !botMoveUsesStockfish(bot) || isEngineReady) {
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
  }, [bot, effectiveGameOver, isBotGame, isEngineReady, turn]);

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
      viewingHistory,
      botBehavior: bot?.behavior,
      botId: bot?.id,
    });

    if (!isBotGame || !bot || effectiveGameOver || pendingPromotion || viewingHistory) {
      botDiagLog('bot-turn effect exit', { reason: viewingHistory ? 'viewing_history' : 'preconditions' });
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
        requestBotTurnRetry(turnKey, cancelled ? 'bot-turn effect cancelled' : 'bot-turn epoch changed');
        return;
      }

      const applyBotMove = async () => {
        await waitUntilPlayerMoveQualityVisible(
          playerMoveClassificationRef.current,
          waitForNextFrame,
        );
        const revealDelayStartedAt = Date.now();
        const revealDelayPromise = waitForBotMoveRevealDelay(revealDelayStartedAt);
        const applyStartedAt = Date.now();
        const board = gameRef.current;
        const fenAtSearchStart = board.fen();
        const historyAtSearchStart = board.history();
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
          board.turn() !== botColor ||
          board.isGameOver()
        ) {
          botTurnScheduledRef.current = null;
          finishApplyBotMove('early_exit_pre_search', {
            cancelled,
            epoch,
            botActionEpoch: botActionEpochRef.current,
            turn: board.turn(),
            gameOver: board.isGameOver(),
          });
          if (cancelled || botActionEpochRef.current !== epoch) {
            requestBotTurnRetry(
              fenAtSearchStart,
              cancelled ? 'bot-turn cancelled before search' : 'bot-turn epoch changed before search',
            );
          }
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

          const boardAfterSearch = gameRef.current;
          if (
            cancelled ||
            botActionEpochRef.current !== epoch ||
            !botMove ||
            boardAfterSearch.fen() !== fenAtSearchStart ||
            boardAfterSearch.turn() !== botColor ||
            isViewingHistory(gameSessionRef.current)
          ) {
            botTurnScheduledRef.current = null;
            const stillBotTurn =
              botActionEpochRef.current === epoch &&
              boardAfterSearch.turn() === botColor &&
              !boardAfterSearch.isGameOver();
            finishApplyBotMove('post_search_validation_failed', {
              cancelled,
              botMove,
              fenNow: boardAfterSearch.fen(),
              stillBotTurn,
            });
            if (boardAfterSearch.fen() === fenAtSearchStart) {
              requestBotTurnRetry(
                fenAtSearchStart,
                cancelled ? 'bot-turn cancelled after search' : 'post-move validation failed',
              );
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
          recordSessionMove(result);
          animateCommittedMoveRef.current(result);
          refreshBoard();
          onMovePlayed(result, fenAtSearchStart);
          maybeStartCheckmateAnimation(result);
          notifyActiveGameSnapshotChange();
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
    effectiveGameOver,
    isBotGame,
    isEngineReady,
    pendingPromotion,
    refreshBoard,
    registerAnalysisCancel,
    sendCommand,
    onMovePlayed,
    notifyMoveSound,
    recordSessionMove,
    notifyActiveGameSnapshotChange,
    turn,
    boardVersion,
    moveSlide,
    botTurnRetryToken,
    maybeStartCheckmateAnimation,
    requestBotTurnRetry,
    isRecoverableBotSearchError,
    viewingHistory,
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
      if (reviewMode) {
        return false;
      }
      if (checkmateOverlayRef.current) {
        return false;
      }
      if (easterEggAnimationRef.current) {
        return false;
      }
      if (activeDragFromRef.current != null) {
        return false;
      }
      if (dragOverlayRef.current || moveSlideRef.current || illegalMoveShakeRef.current) {
        return false;
      }
      if (piecesLocked || pendingPromotion) {
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
    [game, isBotGame, pendingPromotion, piecesLocked, playerColor, reviewMode, turn],
  );

  const canHandleSquarePress = useCallback(() => {
    if (reviewMode) {
      return false;
    }
    if (activeDragFromRef.current != null) {
      return false;
    }
    if (dragOverlayRef.current || moveSlideRef.current || illegalMoveShakeRef.current) {
      return false;
    }
    if (piecesLocked || pendingPromotion) {
      return false;
    }
    if (isBotGame && turn !== playerColor) {
      return false;
    }
    return true;
  }, [isBotGame, pendingPromotion, piecesLocked, playerColor, reviewMode, turn]);

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
      if (!piece || piece.color !== turn || piecesLocked) {
        clearSelection();
        return;
      }
      if (isBotGame && turn !== playerColor) {
        clearSelection();
        return;
      }
      setSelectedSquare(square);
    },
    [clearSelection, game, isBotGame, piecesLocked, playerColor, turn],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    clearSelection();
    clearDragSession();
  }, [clearDragSession, clearSelection]);

  const completePromotion = useCallback(
    (promotion: PieceSymbol) => {
      if (!pendingPromotion || playSealed) {
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
        recordSessionMove(result);
      }

      setPendingPromotion(null);
      clearSelection();
      clearDragSession();
      refreshBoard();

      if (result) {
        clearHint();
        trackMoveClassification(result, fenBefore);
        maybeStartCheckmateAnimation(result);
        notifyActiveGameSnapshotChange();
      }
    },
    [clearDragSession, clearHint, clearSelection, game, maybeStartCheckmateAnimation, notifyActiveGameSnapshotChange, notifyMoveSound, pendingPromotion, playSealed, recordSessionMove, refreshBoard, trackMoveClassification],
  );

  const tryMove = useCallback(
    (from: Square, to: Square, options?: { keepSlideOverlay?: boolean }) => {
      if (playSealed) {
        return false;
      }

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
        recordSessionMove(result);
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
        trackMoveClassification(result, fenBefore);
        maybeStartCheckmateAnimation(result);
        notifyActiveGameSnapshotChange();
      }
      return Boolean(result);
    },
    [clearDragSession, clearDragVisual, clearHint, clearSelection, game, maybeStartCheckmateAnimation, notifyActiveGameSnapshotChange, notifyMoveSound, playSealed, recordSessionMove, refreshBoard, trackMoveClassification],
  );

  const startMoveSlide = useCallback(
    (
      from: Square,
      to: Square,
      piece: { color: Color; type: PieceSymbol },
      translate: { x: number; y: number },
      intent: MoveSlideAnimation['intent'],
      isCapture = false,
      fromDrag = false,
    ) => {
      moveSlideEffectKeyRef.current += 1;
      const nextSlide: MoveSlideAnimation = {
        from,
        to,
        piece,
        startTranslateX: translate.x,
        startTranslateY: translate.y,
        fromDrag,
        effectKey: moveSlideEffectKeyRef.current,
        intent,
        isCapture,
      };
      moveSlideRef.current = nextSlide;
      setMoveSlide(nextSlide);
    },
    [],
  );

  animateCommittedMoveRef.current = (move: Move) => {
    startMoveSlide(
      move.from,
      move.to,
      { color: move.color, type: move.piece },
      { x: 0, y: 0 },
      'commit',
      Boolean(move.captured),
      false,
    );
  };

  const beginAnimatedMove = useCallback(
    (
      from: Square,
      to: Square,
      translate: { x: number; y: number },
      fromDrag = false,
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
        startMoveSlide(from, to, piecePayload, translate, 'promotion', false, fromDrag);
        clearDragVisual();
        return true;
      }

      if (moveSlideRef.current) {
        setMoveSlide(null);
        moveSlideRef.current = null;
      }

      startMoveSlide(from, to, piecePayload, translate, 'commit', move.isCapture(), fromDrag);
      tryMove(from, to, { keepSlideOverlay: true });
      clearDragVisual();
      return true;
    },
    [clearDragVisual, clearSelection, startMoveSlide, tryMove],
  );

  const handleMoveSlideComplete = useCallback((completedEffectKey: number) => {
    const slide = moveSlideRef.current;
    if (!slide || slide.effectKey !== completedEffectKey) {
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
      if (
        dragOverlayRef.current &&
        activeDragFromRef.current == null &&
        !moveSlideRef.current &&
        !illegalMoveShakeRef.current
      ) {
        clearDragVisual();
      }

      if (dragOverlayRef.current || moveSlideRef.current || illegalMoveShakeRef.current) {
        return;
      }
      if (suppressPressRef.current) {
        suppressPressRef.current = false;
        return;
      }
      if (piecesLocked || pendingPromotion) {
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
    [beginAnimatedMove, clearDragVisual, clearSelection, isBotGame, pendingPromotion, piecesLocked, playIllegalSound, playerColor, selectSquare, selectedSquare, startIllegalMoveShake, turn],
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
        playerColorRef.current,
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
        playerColorRef.current,
      );

      clearSelection();

      if (!piece) {
        clearDragVisual();
        return;
      }

      const piecePayload = { color: piece.color, type: piece.type };

      if (targetSquare && targetSquare !== from) {
        if (beginAnimatedMove(from, targetSquare, translate, true)) {
          return;
        }

        playIllegalSound();
        startMoveSlide(from, from, piecePayload, translate, 'return', false, true);
        clearDragVisual();
        return;
      }

      startMoveSlide(from, from, piecePayload, translate, 'return', false, true);
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
        playerColorRef.current,
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

      if (dragOverlayRef.current != null) {
        clearDragVisual();
      }
    },
    [],
  );

  interactionHandlersRef.current = {
    gameOver: effectiveGameOver,
    turn,
    pieceSize,
    selectSquare,
    clearSelection,
    finishDrag,
    handleSquarePress,
    completePanEnd,
    clearDragVisual,
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

          if (dragOverlayRef.current?.from !== square) {
            interactionHandlersRef.current.clearDragVisual();
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
          });

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
            playerColorRef.current,
            dragTranslateX,
            dragTranslateY,
          );

          lastDragPageRef.current = { pageX, pageY };
          pendingDragPageRef.current = { pageX, pageY };
          pendingDragGestureRef.current = { dx: translate.x, dy: translate.y };

          if (exceedsDragMovementThreshold(gesture.dx, gesture.dy)) {
            movedDuringPanRef.current = true;
            startDragOverlayIfNeededRef.current(square);
          }

          const hoverTarget = squareFromPageCoords(
            pageX,
            pageY,
            boardLayoutRef.current,
            boardOrientationRef.current,
            playerColorRef.current,
          );
          if (hoverTarget !== hoverSquareRef.current) {
            hoverSquareRef.current = hoverTarget;
            setHoverSquare(hoverTarget);
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
            exceedsDragMovementThreshold(gesture.dx, gesture.dy);
          const dropPageX = lastDragPageRef.current?.pageX ?? event.nativeEvent.pageX;
          const dropPageY = lastDragPageRef.current?.pageY ?? event.nativeEvent.pageY;
          interactionHandlersRef.current.completePanEnd(
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
            exceedsDragMovementThreshold(gesture.dx, gesture.dy);
          const dropPageX = lastDragPageRef.current?.pageX ?? event.nativeEvent.pageX;
          const dropPageY = lastDragPageRef.current?.pageY ?? event.nativeEvent.pageY;
          interactionHandlersRef.current.completePanEnd(
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
    ? promotionPickerPosition(
        pendingPromotion.to,
        squareSize,
        boardOrientation,
        playerColor,
        PROMOTION_PICKER_SCALE,
      )
    : null;

  const classificationBadgeSize = Math.max(18, squareSize * 0.28);
  const classificationBadgeSquare = displayedClassification?.square ?? null;
  const pieceOnClassificationSquare = classificationBadgeSquare
    ? game.get(classificationBadgeSquare)
    : null;
  const classificationPieceLanding =
    classificationBadgeSquare && pieceOnClassificationSquare
      ? getPieceLandingPosition(
          classificationBadgeSquare,
          squareSize,
          pieceSize,
          boardOrientation,
          playerColor,
        )
      : null;
  const showClassificationBadge =
    displayedClassification != null &&
    pieceOnClassificationSquare != null &&
    classificationPieceLanding != null;
  const canScrollPage = !reviewEmbedded && (effectiveGameOver || scrollUnlocked);
  const showScrollLockButton = !reviewMode && !reviewEmbedded && !effectiveGameOver;
  const classificationBadgeLeft = classificationPieceLanding
    ? Math.min(
        classificationPieceLanding.left + pieceSize - classificationBadgeSize * 0.88,
        boardSize - classificationBadgeSize,
      )
    : 0;
  const classificationBadgeTop = classificationPieceLanding
    ? Math.max(0, classificationPieceLanding.top - classificationBadgeSize * 0.1)
    : 0;
  const ReviewPageContainer = reviewEmbedded ? View : ScrollView;

  return (
    <View
      style={[
        styles.screen,
        reviewEmbedded && styles.screenEmbedded,
        reviewEmbedded ? { height: playStackHeight + 8 } : null,
      ]}
    >
      {isFreeBoard && !reviewMode ? (
        <View
          style={[
            chromeStyles.sideSelectorAnchor,
            {
              top: insets.top + SCREEN_BACK_BUTTON_TOP,
              right: SCREEN_BACK_BUTTON_LEFT,
            },
          ]}
          pointerEvents="box-none"
        >
          {isPassAndPlay ? (
            <View style={chromeStyles.passAndPlayHeader}>
              <Text style={chromeStyles.passAndPlayTurnText}>{passAndPlayTurnLabel(turn)}</Text>
              <Pressable
                style={({ pressed }) => [
                  chromeStyles.sideSelectorButton,
                  pressed && chromeStyles.sideSelectorButtonPressed,
                ]}
                onPress={disablePassAndPlay}
                accessibilityRole="button"
                accessibilityLabel="Switch back to solo board"
              >
                <Text style={chromeStyles.sideSelectorText}>Solo Board</Text>
              </Pressable>
            </View>
          ) : (
            <View style={chromeStyles.sideSelectorRow}>
              <Pressable
                style={({ pressed }) => [
                  chromeStyles.sideSelectorButton,
                  playerColor === 'w' && chromeStyles.sideSelectorButtonActive,
                  pressed && chromeStyles.sideSelectorButtonPressed,
                ]}
                onPress={() => {
                  setPlayerColor('w');
                  setBoardOrientation('white');
                }}
                accessibilityRole="button"
                accessibilityLabel="Play as White"
              >
                <Text
                  style={[
                    chromeStyles.sideSelectorText,
                    playerColor === 'w' && chromeStyles.sideSelectorTextActive,
                  ]}
                >
                  Play as White
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  chromeStyles.sideSelectorButton,
                  playerColor === 'b' && chromeStyles.sideSelectorButtonActive,
                  pressed && chromeStyles.sideSelectorButtonPressed,
                ]}
                onPress={() => {
                  setPlayerColor('b');
                  setBoardOrientation('black');
                }}
                accessibilityRole="button"
                accessibilityLabel="Play as Black"
              >
                <Text
                  style={[
                    chromeStyles.sideSelectorText,
                    playerColor === 'b' && chromeStyles.sideSelectorTextActive,
                  ]}
                >
                  Play as Black
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      <View
        style={[
          styles.mainColumn,
          reviewEmbedded && styles.mainColumnEmbedded,
          {
            paddingTop: reviewEmbedded ? 4 : insets.top + HEADER_ROW_HEIGHT,
            paddingBottom: reviewEmbedded ? 4 : insets.bottom,
          },
        ]}
        onLayout={measureBoard}
      >
      <ReviewPageContainer
        ref={reviewEmbedded ? undefined : historyScrollRef}
        style={reviewEmbedded ? { width: '100%', height: playStackHeight } : styles.pageScroll}
        contentContainerStyle={
          reviewEmbedded
            ? undefined
            : [
                styles.pageScrollContent,
                effectiveGameOver && historyScrollPaddingBottom > 0
                  ? { paddingBottom: historyScrollPaddingBottom }
                  : null,
              ]
        }
        scrollEnabled={canScrollPage}
        showsVerticalScrollIndicator={canScrollPage}
        keyboardShouldPersistTaps="handled"
      >
      <View ref={wrapperRef} style={styles.playSection}>
      <View style={[styles.topBannerSlot, { minHeight: topBannerMinHeight }]}>
        {showRepetitionDrawWarning ? (
          <View
            style={chromeStyles.repetitionWarningBanner}
            accessibilityRole="text"
            accessibilityLabel={REPETITION_DRAW_WARNING_TEXT}
          >
            <Text style={chromeStyles.repetitionWarningText} numberOfLines={2}>
              {REPETITION_DRAW_WARNING_TEXT}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.playStack}>
      <View style={[styles.boardRow, { maxWidth: windowWidth }]}>
        <View style={styles.boardColumn}>
          <View style={{ marginLeft: EVAL_BAR_WIDTH + EVAL_BAR_MARGIN }}>
          <CapturedPiecesBar
            captures={topSideCaptures}
            captorColor={topSideColor}
            advantagePoints={topCaptureAdvantage}
            width={boardSize}
            pieceIconSize={capturedPieceIconSize}
            portraitSource={topPortraitSource}
            portraitLabel={topPortraitLabel}
          />
          </View>
          <View style={[styles.boardEvalRow, { gap: EVAL_BAR_MARGIN }]}>
            <EvalBar
              height={boardRenderedHeight}
              eval={displayedEval}
              boardOrientation={boardOrientation}
            />
          <View
            style={[
              styles.boardBorder,
              { width: boardSize + BOARD_BORDER, height: boardRenderedHeight },
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
                  playerColor,
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
                const isEasterEggHiddenSquare =
                  easterEggAnimation != null &&
                  (square === easterEggAnimation.from || square === easterEggAnimation.to);
                const isPendingFrom = pendingPromotion?.from === square;
                const isPendingTo = pendingPromotion?.to === square;
                const isHiddenDuringCommitSlide =
                  moveSlide?.intent === 'commit' && moveSlide.to === square;
                const usePanResponderShell = !!piece;
                const showPiece = piece && !isPendingFrom && !isHiddenDuringCommitSlide;
                const hidePiece = isDraggingFromSquare || isEasterEggHiddenSquare;
                const celebrationOnSquare =
                  celebrationGlow?.square === square ? celebrationGlow : null;

                return (
                  <BoardSquare
                    key={`${visualRankIndex}-${visualFileIndex}`}
                    square={square}
                    pieceColor={piece?.color}
                    pieceType={piece?.type}
                    isLight={isLight}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    isLegalMove={isLegalMove}
                    isCapture={isCapture}
                    hidePiece={hidePiece}
                    showPiece={Boolean(showPiece)}
                    showPendingPawn={Boolean(isPendingTo && pendingPromotion)}
                    pendingPawnColor={pendingPromotion?.color}
                    usePanResponder={usePanResponderShell}
                    panHandlers={
                      usePanResponderShell
                        ? getPiecePanResponder(square).panHandlers
                        : undefined
                    }
                    onSquarePress={handleSquarePress}
                    squareSize={squareSize}
                    pieceSize={pieceSize}
                    celebrationGlowColor={
                      celebrationOnSquare
                        ? CLASSIFICATION_BADGE_STYLES[celebrationOnSquare.classification]
                            .backgroundColor
                        : undefined
                    }
                    celebrationGlowEffectKey={celebrationOnSquare?.effectKey}
                    onCelebrationComplete={clearCelebrationGlow}
                    fileLabel={visualRankIndex === 7 ? square[0] : undefined}
                    rankLabel={visualFileIndex === 0 ? square[1] : undefined}
                  />
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
                  key={`slide-${moveSlide.effectKey}`}
                  from={moveSlide.from}
                  to={moveSlide.to}
                  piece={moveSlide.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  playerColor={playerColor}
                  startTranslateX={moveSlide.startTranslateX}
                  startTranslateY={moveSlide.startTranslateY}
                  fromDrag={moveSlide.fromDrag}
                  effectKey={moveSlide.effectKey}
                  onComplete={handleMoveSlideComplete}
                />
              ) : null}

              {illegalMoveShake ? (
                <PieceShakeOverlay
                  key={`shake-${illegalMoveShake.effectKey}`}
                  square={illegalMoveShake.square}
                  piece={illegalMoveShake.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  playerColor={playerColor}
                  effectKey={illegalMoveShake.effectKey}
                  onComplete={handleIllegalMoveShakeComplete}
                />
              ) : null}

              {easterEggAnimation && (
                <EasterEggMoveOverlay
                  key={`egg-${easterEggAnimation.effectKey}`}
                  from={easterEggAnimation.from}
                  to={easterEggAnimation.to}
                  piece={easterEggAnimation.piece}
                  squareSize={squareSize}
                  pieceSize={pieceSize}
                  boardOrientation={boardOrientation}
                  playerColor={playerColor}
                  effectKey={easterEggAnimation.effectKey}
                  onComplete={handleEasterEggComplete}
                />
              )}

              {checkmateOverlay ? (
                <CheckmateOverlay
                  key={`mate-${checkmateOverlay.effectKey}`}
                  matingSquare={checkmateOverlay.matingSquare}
                  winningKingSquare={checkmateOverlay.winningKingSquare}
                  losingKingSquare={checkmateOverlay.losingKingSquare}
                  squareSize={squareSize}
                  boardOrientation={boardOrientation}
                  playerColor={playerColor}
                  effectKey={checkmateOverlay.effectKey}
                  onComplete={handleCheckmateOverlayComplete}
                />
              ) : null}

              {showClassificationBadge && displayedClassification ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.classificationBadgeHost,
                    {
                      left: classificationBadgeLeft,
                      top: classificationBadgeTop,
                      width: displayedClassification.missedWin
                        ? classificationBadgeSize * 1.65
                        : classificationBadgeSize,
                      height: classificationBadgeSize,
                      flexDirection: 'row',
                      gap: 2,
                    },
                  ]}
                >
                  <MoveClassificationBadge
                    classification={displayedClassification.classification}
                    size={classificationBadgeSize}
                  />
                  {displayedClassification.missedWin ? (
                    <MoveClassificationBadge
                      classification="MissedWin"
                      size={Math.max(14, classificationBadgeSize * 0.78)}
                    />
                  ) : null}
                </View>
              ) : null}

              {reviewMode && reviewDisplayArrow && reviewShowBestMoveArrows ? (
                <HintOverlay
                  from={reviewDisplayArrow.from}
                  to={reviewDisplayArrow.to}
                  squareSize={squareSize}
                  boardSize={boardSize}
                  boardOrientation={boardOrientation}
                  playerColor={playerColor}
                  showArrow
                  arrowOnly
                />
              ) : null}

              {!reviewMode && hint ? (
                <HintOverlay
                  from={hint.from}
                  to={hint.to}
                  squareSize={squareSize}
                  boardSize={boardSize}
                  boardOrientation={boardOrientation}
                  playerColor={playerColor}
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
                  playerColor={playerColor}
                  translateX={dragTranslateX}
                  translateY={dragTranslateY}
                />
              ) : null}
            </View>
          </View>
          </View>

          <View style={{ marginLeft: EVAL_BAR_WIDTH + EVAL_BAR_MARGIN }}>
          <CapturedPiecesBar
            captures={bottomSideCaptures}
            captorColor={bottomSideColor}
            advantagePoints={bottomCaptureAdvantage}
            width={boardSize}
            pieceIconSize={capturedPieceIconSize}
            portraitSource={bottomPortraitSource}
            portraitLabel={bottomPortraitLabel}
          />
          </View>

          <View
            style={[
              styles.openingLabelSlot,
              {
                width: boardSize + EVAL_BAR_WIDTH + EVAL_BAR_MARGIN,
                alignItems: 'flex-start',
              },
            ]}
          >
            {isFreeBoard && !isPassAndPlay && onOpenFreeBoardModes ? (
              <Pressable
                style={({ pressed }) => [
                  chromeStyles.freeBoardModesButton,
                  { marginLeft: EVAL_BAR_WIDTH + EVAL_BAR_MARGIN },
                  pressed && chromeStyles.freeBoardModesButtonPressed,
                ]}
                onPress={onOpenFreeBoardModes}
                accessibilityRole="button"
                accessibilityLabel="Open free board modes"
                hitSlop={8}
              >
                <Text style={chromeStyles.freeBoardModesButtonText}>Free Board Modes</Text>
              </Pressable>
            ) : null}
            {openingLabel ? (
              <View
                style={{
                  width: boardSize,
                  marginLeft: isFreeBoard ? 0 : EVAL_BAR_WIDTH + EVAL_BAR_MARGIN,
                  alignItems: isFreeBoard ? 'center' : 'flex-end',
                }}
              >
                <Text
                  style={[styles.openingLabel, isFreeBoard ? styles.openingLabelCentered : null]}
                  numberOfLines={2}
                >
                  {openingLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ marginLeft: EVAL_BAR_WIDTH + EVAL_BAR_MARGIN }}>
          <View style={[chromeStyles.boardControls, { width: boardSize }]}>
            <View style={chromeStyles.bottomBar}>
              <View
                style={[
                  chromeStyles.bottomBarSide,
                  chromeStyles.bottomBarSideLeft,
                  isFreeBoard && chromeStyles.bottomBarSideLeftFree,
                  reviewMode && chromeStyles.bottomBarSideLeftReview,
                ]}
                pointerEvents="box-none"
              >
                {reviewMode ? (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        chromeStyles.actionButton,
                        chromeStyles.actionButtonNav,
                        chromeStyles.actionButtonNavCompact,
                        !canGoToReviewStart && chromeStyles.actionButtonDisabled,
                        pressed && canGoToReviewStart && chromeStyles.actionButtonPressed,
                      ]}
                      onPress={jumpToReviewStart}
                      disabled={!canGoToReviewStart}
                      accessibilityRole="button"
                      accessibilityLabel="Go to starting position"
                      accessibilityState={{ disabled: !canGoToReviewStart }}
                    >
                      <Text
                        style={[
                          chromeStyles.actionButtonText,
                          chromeStyles.actionButtonNavText,
                          chromeStyles.actionButtonNavTextCompact,
                          !canGoToReviewStart && chromeStyles.actionButtonTextDisabled,
                        ]}
                      >
                        ⏮
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        chromeStyles.actionButton,
                        chromeStyles.actionButtonNav,
                        reviewAutoplay && chromeStyles.actionButtonHintActive,
                        reviewPlayDisabled && chromeStyles.actionButtonDisabled,
                        pressed && !reviewPlayDisabled && chromeStyles.actionButtonPressed,
                      ]}
                      onPress={toggleReviewAutoplay}
                      disabled={reviewPlayDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={
                      reviewPlaybackLocked
                        ? 'Analysis in progress'
                        : reviewAutoplay
                          ? 'Stop autoplay'
                          : 'Autoplay from here'
                    }
                      accessibilityState={{ disabled: reviewPlayDisabled }}
                    >
                      <Text
                        style={[
                          chromeStyles.actionButtonText,
                          chromeStyles.actionButtonNavText,
                          reviewAutoplay && chromeStyles.actionButtonHintTextActive,
                          reviewPlayDisabled && chromeStyles.actionButtonTextDisabled,
                        ]}
                      >
                        {reviewAutoplay ? '⏸' : '▶'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        chromeStyles.actionButton,
                        chromeStyles.actionButtonNav,
                        chromeStyles.actionButtonNavCompact,
                        !canGoToReviewEnd && chromeStyles.actionButtonDisabled,
                        pressed && canGoToReviewEnd && chromeStyles.actionButtonPressed,
                      ]}
                      onPress={jumpToReviewEnd}
                      disabled={!canGoToReviewEnd}
                      accessibilityRole="button"
                      accessibilityLabel="Go to final position"
                      accessibilityState={{ disabled: !canGoToReviewEnd }}
                    >
                      <Text
                        style={[
                          chromeStyles.actionButtonText,
                          chromeStyles.actionButtonNavText,
                          chromeStyles.actionButtonNavTextCompact,
                          !canGoToReviewEnd && chromeStyles.actionButtonTextDisabled,
                        ]}
                      >
                        ⏭
                      </Text>
                    </Pressable>
                  </>
                ) : (
                <Pressable
                  style={({ pressed }) => [
                    chromeStyles.actionButton,
                    isFreeBoard ? chromeStyles.actionButtonIconCompact : chromeStyles.actionButtonIcon,
                    !canResign && chromeStyles.actionButtonDisabled,
                    pressed && canResign && chromeStyles.actionButtonPressed,
                  ]}
                  onPress={confirmResign}
                  disabled={!canResign}
                  accessibilityRole="button"
                  accessibilityLabel="Resign game"
                  accessibilityState={{ disabled: !canResign }}
                >
                  <Text
                    style={[
                      chromeStyles.actionButtonFlagIcon,
                      isFreeBoard && chromeStyles.actionButtonFlagIconCompact,
                      !canResign && chromeStyles.actionButtonTextDisabled,
                    ]}
                  >
                    ⚑
                  </Text>
                </Pressable>
                )}
                {!reviewMode && !isPassAndPlay ? (
                <View style={chromeStyles.bottomBarHintGroup} pointerEvents="box-none">
                  <Pressable
                    style={({ pressed }) => [
                      chromeStyles.actionButton,
                      isFreeBoard ? chromeStyles.actionButtonHintCompact : chromeStyles.actionButtonHint,
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
                    <ActionLeadingIcon
                      name="hint"
                      color={
                        hint != null && !hint.showArrow
                          ? theme.hintButtonText
                          : !canRequestHint || hintLoading
                            ? theme.actionButtonTextDisabled
                            : theme.accentText
                      }
                      size={isFreeBoard ? 16 : 18}
                    />
                    <Text
                      style={[
                        chromeStyles.actionButtonHintText,
                        isFreeBoard && chromeStyles.actionButtonHintTextCompact,
                        (!canRequestHint || hintLoading) && chromeStyles.actionButtonTextDisabled,
                        hint != null && !hint.showArrow && chromeStyles.actionButtonHintTextActive,
                      ]}
                    >
                      Hint
                    </Text>
                  </Pressable>
                  {isFreeBoard ? (
                    <Pressable
                      style={({ pressed }) => [
                        chromeStyles.actionButton,
                        chromeStyles.actionButtonHintCompact,
                        hint != null && hint.showArrow && chromeStyles.actionButtonHintActive,
                        (!canRequestHint || hintLoading) && chromeStyles.actionButtonDisabled,
                        pressed && canRequestHint && !hintLoading && chromeStyles.actionButtonPressed,
                      ]}
                      onPress={() => void requestHintDisplay(true)}
                      disabled={!canRequestHint || hintLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Show ultra hint with move arrow"
                      accessibilityState={{ disabled: !canRequestHint || hintLoading }}
                    >
                      <ActionLeadingIcon
                        name="ultraHint"
                        color={
                          hint != null && hint.showArrow
                            ? theme.hintButtonText
                            : !canRequestHint || hintLoading
                              ? theme.actionButtonTextDisabled
                              : theme.accentText
                        }
                        size={16}
                      />
                      <Text
                        style={[
                          chromeStyles.actionButtonHintText,
                          chromeStyles.actionButtonHintTextCompact,
                          (!canRequestHint || hintLoading) && chromeStyles.actionButtonTextDisabled,
                          hint != null && hint.showArrow && chromeStyles.actionButtonHintTextActive,
                        ]}
                      >
                        Ultra
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                ) : null}
              </View>

              <View style={chromeStyles.bottomBarCenter} pointerEvents="box-none">
                <View style={chromeStyles.bottomBarCenterCluster}>
                  {showScrollLockButton ? (
                    <ScrollLockButton
                      locked={!scrollUnlocked}
                      onToggle={() => setScrollUnlocked((current) => !current)}
                    />
                  ) : null}
                  <GameMenuButton
                    onFlipBoard={flipBoard}
                    onResetBoard={resetGame}
                    onResign={confirmResign}
                    onAbortGame={confirmAbortGame}
                    onSaveGame={promptSaveGame}
                    onSaveReview={onSaveReview}
                    showFlipBoard={!isPassAndPlay}
                    reviewOnlyFlipBoard={reviewMode}
                  />
                </View>
              </View>

              <View
                style={[chromeStyles.bottomBarSide, chromeStyles.bottomBarSideRight]}
                pointerEvents="box-none"
              >
                <Pressable
                  style={({ pressed }) => [
                    chromeStyles.actionButton,
                    chromeStyles.actionButtonNav,
                    !canGoBack && chromeStyles.actionButtonDisabled,
                    pressed && canGoBack && chromeStyles.actionButtonPressed,
                  ]}
                  onPress={holdBack.onPress}
                  onPressIn={holdBack.onPressIn}
                  onPressOut={holdBack.onPressOut}
                  disabled={!canGoBack}
                  accessibilityRole="button"
                  accessibilityLabel="Previous move"
                  accessibilityState={{ disabled: !canGoBack }}
                >
                  <Text
                    style={[
                      chromeStyles.actionButtonText,
                      chromeStyles.actionButtonNavText,
                      !canGoBack && chromeStyles.actionButtonTextDisabled,
                    ]}
                  >
                    {'<'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    chromeStyles.actionButton,
                    chromeStyles.actionButtonNav,
                    !canGoForward && chromeStyles.actionButtonDisabled,
                    pressed && canGoForward && chromeStyles.actionButtonPressed,
                  ]}
                  onPress={holdForward.onPress}
                  onPressIn={holdForward.onPressIn}
                  onPressOut={holdForward.onPressOut}
                  disabled={!canGoForward}
                  accessibilityRole="button"
                  accessibilityLabel="Next move"
                  accessibilityState={{ disabled: !canGoForward }}
                >
                  <Text
                    style={[
                      chromeStyles.actionButtonText,
                      chromeStyles.actionButtonNavText,
                      !canGoForward && chromeStyles.actionButtonTextDisabled,
                    ]}
                  >
                    {'>'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          </View>
        </View>
      </View>
      </View>
      </View>
        {!reviewMode && session.moves.length > 0 ? (
          <MoveHistoryList
            moves={session.moves}
            classifiedMoves={classifiedMovesRef.current}
            currentIndex={session.currentIndex}
            width={boardSize}
            onSelectPly={jumpToPly}
            embedded
          />
        ) : null}
      </ReviewPageContainer>
      </View>

      <AccuracyReport
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        moves={reportMoves}
        gameResult={reportResultOverride ?? describeGameResult(game, reportEndedEarly)}
        openingName={openingLabel}
      />
    </View>
  );
});

export default ChessBoard;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
  },
  screenEmbedded: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
  },
  mainColumn: {
    flex: 1,
    width: '100%',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  mainColumnEmbedded: {
    flex: 1,
    width: '100%',
  },
  playSection: {
    width: '100%',
    flexShrink: 0,
  },
  topBannerSlot: {
    width: '100%',
  },
  playStack: {
    width: '100%',
    alignItems: 'center',
    flexShrink: 0,
  },
  pageScroll: {
    flex: 1,
    width: '100%',
  },
  pageScrollEmbedded: {
    flexGrow: 0,
    flexShrink: 0,
  },
  pageScrollContent: {
    alignItems: 'center',
  },
  pageScrollContentEmbedded: {
    flexGrow: 0,
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
  boardEvalRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  boardColumn: {
    alignItems: 'center',
    flexShrink: 0,
  },
  openingLabelSlot: {
    minHeight: OPENING_LABEL_SLOT_HEIGHT,
    justifyContent: 'center',
    gap: 4,
  },
  openingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'right',
    lineHeight: 15,
  },
  openingLabelCentered: {
    textAlign: 'center',
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
      fontSize: 14,
      fontWeight: '700',
      includeFontPadding: false,
    },
    sideSelectorTextActive: {
      color: theme.textPrimary,
    },
    passAndPlayHeader: {
      alignItems: 'flex-end',
      gap: 8,
      maxWidth: 180,
    },
    passAndPlayTurnText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'right',
    },
    freeBoardModesButton: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.backButtonBorder,
      backgroundColor: theme.backButtonBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    freeBoardModesButtonPressed: {
      backgroundColor: theme.backButtonBackgroundPressed,
    },
    freeBoardModesButtonText: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: '700',
      includeFontPadding: false,
    },
    boardControls: {
      marginTop: 0,
      position: 'relative',
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: 56,
      position: 'relative',
    },
    bottomBarSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      zIndex: 1,
    },
    bottomBarSideLeft: {
      justifyContent: 'flex-start',
      paddingRight: BOTTOM_BAR_CENTER_RESERVE,
    },
    bottomBarSideLeftFree: {
      gap: 6,
      paddingRight: BOTTOM_BAR_CENTER_RESERVE_FREE,
    },
    bottomBarSideLeftReview: {
      gap: 6,
      paddingRight: BOTTOM_BAR_CENTER_RESERVE_FREE,
    },
    bottomBarHintGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
      minWidth: 0,
    },
    bottomBarSideRight: {
      justifyContent: 'flex-end',
      paddingLeft: BOTTOM_BAR_CENTER_RESERVE,
    },
    bottomBarCenter: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    bottomBarCenterCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    moveHistoryScroll: {
      width: '100%',
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
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.actionButtonBorder,
      backgroundColor: theme.actionButtonBackground,
    },
    actionButtonPrimary: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 44,
    },
    actionButtonNav: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    actionButtonNavCompact: {
      minWidth: 38,
      minHeight: 40,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    actionButtonIcon: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 10,
    },
    actionButtonIconCompact: {
      minWidth: 40,
      minHeight: 40,
      paddingHorizontal: 8,
      flexShrink: 0,
    },
    actionButtonHint: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 6,
      paddingVertical: 4,
      flexShrink: 1,
    },
    actionButtonHintCompact: {
      minWidth: 36,
      maxWidth: 44,
      minHeight: 40,
      paddingHorizontal: 2,
      paddingVertical: 3,
      flexShrink: 1,
    },
    actionButtonFlagIcon: {
      color: theme.destructiveText,
      fontSize: 22,
      lineHeight: 24,
      fontWeight: '700',
    },
    actionButtonFlagIconCompact: {
      fontSize: 20,
      lineHeight: 22,
    },
    actionButtonSecondary: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      minHeight: 40,
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
      fontWeight: '600',
    },
    actionButtonPrimaryText: {
      fontSize: 16,
    },
    actionButtonNavText: {
      fontSize: 22,
      lineHeight: 24,
    },
    actionButtonNavTextCompact: {
      fontSize: 18,
      lineHeight: 20,
    },
    actionButtonSecondaryText: {
      fontSize: 13,
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
      color: theme.accentText,
      fontSize: 10,
      fontWeight: '600',
      lineHeight: 12,
    },
    actionButtonHintTextCompact: {
      fontSize: 9,
      lineHeight: 10,
    },
    actionButtonHintTextActive: {
      color: theme.hintButtonText,
    },
    repetitionWarningBanner: {
      alignSelf: 'center',
      maxWidth: '100%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentSurface,
    },
    repetitionWarningText: {
      color: theme.accentText,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      textAlign: 'center',
    },
  });
}
