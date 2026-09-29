import type { Color, Move } from 'chess.js';

import { isForcedMove } from './forcedMove';
import { detectMissedWin, moverWinningMatePlies, opponentWinningMatePlies } from './missedWin';
import { isMaterialSacrifice, isMissedMaterialOpportunity } from './materialEval';
import { getOpeningBook } from './openingBook';
import {
  bestSecondWinPercentGap,
  evalCentipawnsForMover,
  isSameSquarePromotion,
  liveEvalFromAnalysis,
  moveToUci,
  positionAnalysisFromMultiPv,
  uciMovesMatch,
  type AnalysisSearchMode,
  type MultiPvAnalysis,
  type PositionAnalysis,
} from './stockfishAnalysis';
import { isAnalysisCancelled } from './stockfishCancel';
import { getTerminalPositionAnalysis } from './terminalPosition';
import {
  assertClassificationInvariants,
  centipawnsToWinPercent,
  classifyMove,
} from '../utils/moveClassification';
import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';

export type ClassifyPlyDeps = {
  runAnalysis: (fen: string, search: AnalysisSearchMode) => Promise<PositionAnalysis>;
  runMultiPvAnalysis: (
    fen: string,
    multipv: number,
    search: AnalysisSearchMode,
  ) => Promise<MultiPvAnalysis>;
};

export type ClassifyPlyInput = {
  move: Move;
  fenBefore: string;
  search: AnalysisSearchMode;
  gameSanMovesBefore: readonly string[];
  hasLeftBook: boolean;
};

export type ClassifyPlyResult = {
  record: ClassifiedMoveRecord;
  hasLeftBook: boolean;
  afterAnalysis: PositionAnalysis;
};

async function runClassificationAnalysis(
  deps: ClassifyPlyDeps,
  fen: string,
  search: AnalysisSearchMode,
): Promise<PositionAnalysis> {
  const terminal = getTerminalPositionAnalysis(fen);
  if (terminal) {
    return terminal;
  }
  return deps.runAnalysis(fen, search);
}

async function analyzeBeforeMove(
  deps: ClassifyPlyDeps,
  fenBefore: string,
  search: AnalysisSearchMode,
  mover: Color,
): Promise<{ analysis: PositionAnalysis; winPercentGap: number }> {
  const terminal = getTerminalPositionAnalysis(fenBefore);
  if (terminal) {
    return { analysis: terminal, winPercentGap: 0 };
  }

  try {
    const multiPv = await deps.runMultiPvAnalysis(fenBefore, 2, search);
    const analysis = positionAnalysisFromMultiPv(multiPv);
    if (analysis.bestMoveUci) {
      return {
        analysis,
        winPercentGap: bestSecondWinPercentGap(multiPv, mover, centipawnsToWinPercent),
      };
    }
  } catch (error) {
    if (isAnalysisCancelled(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Move Classification] multipv analysis failed:', message);
  }

  return {
    analysis: await runClassificationAnalysis(deps, fenBefore, search),
    winPercentGap: 0,
  };
}

function wasPlayedBestMove(
  playedUci: string,
  bestUci: string,
  afterAnalysis: PositionAnalysis,
  mover: Color,
): boolean {
  if (uciMovesMatch(playedUci, bestUci)) {
    return true;
  }
  // Queen vs underpromotion: treat a mating underpromotion as the same shot.
  return isSameSquarePromotion(playedUci, bestUci) && moverWinningMatePlies(afterAnalysis, mover) != null;
}

export async function classifyPly(
  deps: ClassifyPlyDeps,
  input: ClassifyPlyInput,
): Promise<ClassifyPlyResult> {
  const { move, fenBefore, search, gameSanMovesBefore, hasLeftBook } = input;
  const mover = move.color;
  const { analysis: beforeAnalysis, winPercentGap } = await analyzeBeforeMove(
    deps,
    fenBefore,
    search,
    mover,
  );

  const playedUci = moveToUci(move);
  const evalBefore = evalCentipawnsForMover(beforeAnalysis, mover);
  const forced = isForcedMove(fenBefore);

  const fenAfter = move.after;
  const deliveredCheckmate = move.san.includes('#');
  const afterAnalysis = await runClassificationAnalysis(deps, fenAfter, search);
  const evalAfter = evalCentipawnsForMover(afterAnalysis, mover);
  const wasBestMove = wasPlayedBestMove(playedUci, beforeAnalysis.bestMoveUci, afterAnalysis, mover);

  const missedWinResult =
    forced || wasBestMove
      ? {
          missedWin: false,
          detail: null,
          bestMoveEval: null,
          evalDelta: null,
        }
      : detectMissedWin({
          beforeAnalysis,
          bestMoveAfterAnalysis: null,
          afterAnalysis,
          mover,
          wasBestMove,
          deliveredCheckmate,
        });

  const gameSanMoves = [...gameSanMovesBefore, move.san];
  const openingBook = getOpeningBook();
  let nextHasLeftBook = hasLeftBook;
  let isBookMove = false;
  if (!hasLeftBook) {
    isBookMove = openingBook.isSequenceInBook(gameSanMoves);
    if (!isBookMove) {
      nextHasLeftBook = true;
    }
  }

  const materialSacrifice = isMaterialSacrifice(
    fenBefore,
    fenAfter,
    move,
    mover,
    afterAnalysis.bestMoveUci,
  );
  const isUnderpromotion = Boolean(move.promotion && move.promotion !== 'q');
  const missedForcedMate =
    !forced &&
    !wasBestMove &&
    !missedWinResult.missedWin &&
    beforeAnalysis.sideToMove === mover &&
    beforeAnalysis.scoreMate != null &&
    beforeAnalysis.scoreMate > 0;
  const missedMaterialOpportunity =
    !forced &&
    !missedWinResult.missedWin &&
    !wasBestMove &&
    isMissedMaterialOpportunity(fenBefore, beforeAnalysis.bestMoveUci, move);

  const allowsOpponentMate = opponentWinningMatePlies(afterAnalysis, mover) != null;

  const classification = classifyMove({
    evalBeforeMoveCentipawns: evalBefore,
    evalAfterMoveCentipawns: evalAfter,
    wasBestMove,
    isBookMove,
    isMaterialSacrifice: materialSacrifice,
    bestSecondWinPercentGap: winPercentGap,
    missedForcedMate,
    missedMaterialOpportunity,
    isForcedMove: forced,
    allowsOpponentMate,
    deliveredCheckmate,
    isUnderpromotion,
  });

  const missedWinTag = wasBestMove || forced ? false : missedWinResult.missedWin;
  assertClassificationInvariants(classification, wasBestMove, missedWinTag, deliveredCheckmate);

  const record: ClassifiedMoveRecord = {
    move: playedUci,
    san: move.san,
    color: mover,
    classification,
    evalBefore,
    evalAfter,
    mateInWhiteAfter: liveEvalFromAnalysis(afterAnalysis).mateInWhite,
    wasBestMove,
    bestMoveUci: beforeAnalysis.bestMoveUci || undefined,
    fenBefore,
    fenAfter,
    forced,
    missedWin: missedWinTag,
    missedWinDetail: missedWinResult.detail,
    bestMoveEval: missedWinResult.bestMoveEval,
    evalDelta: missedWinResult.evalDelta,
  };

  return {
    record,
    hasLeftBook: nextHasLeftBook,
    afterAnalysis,
  };
}

export function moverColorAtPlyIndex(plyIndex: number): Color {
  return plyIndex % 2 === 0 ? 'w' : 'b';
}
