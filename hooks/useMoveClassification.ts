import type { Move } from 'chess.js';
import { DEFAULT_POSITION, type Square } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isAnalysisCompleteLine, parseBestMove, parseInfoLine } from '../lib/uciParse';
import { isMaterialSacrifice } from '../lib/materialEval';
import {
  ANALYSIS_MOVETIME_MS,
  bestSecondWinPercentGap,
  evalCentipawnsForMover,
  fenSideToMove,
  moveToUci,
  scoreToCentipawns,
  uciMovesMatch,
  type MultiPvAnalysis,
  type PositionAnalysis,
} from '../lib/stockfishAnalysis';
import { useStockfishEngine } from '../components/StockfishWebViewEngine';
import {
  centipawnsToWinPercent,
  classifyMove,
  type MoveClassification,
} from '../utils/moveClassification';
import { getOpeningBook } from '../lib/openingBook';

export type ClassifiedMoveRecord = {
  move: string;
  san: string;
  color: 'w' | 'b';
  classification: MoveClassification;
  evalBefore: number;
  evalAfter: number;
  wasBestMove: boolean;
  fenBefore: string;
  fenAfter: string;
};

export type LatestMoveClassification = {
  square: Square;
  classification: MoveClassification;
};

export function useMoveClassification() {
  const { isReady, sendCommand, addLineListener } = useStockfishEngine();

  const positionAnalysisRef = useRef<PositionAnalysis | null>(null);
  const classifiedMovesRef = useRef<ClassifiedMoveRecord[]>([]);
  const queueRef = useRef<Array<() => Promise<void>>>([]);
  const processingRef = useRef(false);
  const [latestClassification, setLatestClassification] = useState<LatestMoveClassification | null>(
    null,
  );
  const gameSanMovesRef = useRef<string[]>([]);
  const hasLeftBookRef = useRef(false);

  const runAnalysis = useCallback(
    (fen: string): Promise<PositionAnalysis> =>
      new Promise((resolve, reject) => {
        let latestInfo = null as ReturnType<typeof parseInfoLine> | null;
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Stockfish analysis timed out for fen: ${fen}`));
        }, ANALYSIS_MOVETIME_MS + 5_000);

        const unsubscribe = addLineListener((line) => {
          const info = parseInfoLine(line);
          if (info && (info.multipv == null || info.multipv === 1)) {
            latestInfo = info;
          }

          if (isAnalysisCompleteLine(line)) {
            const best = parseBestMove(line);
            cleanup();
            resolve({
              fen,
              sideToMove: fenSideToMove(fen),
              evalCentipawns: scoreToCentipawns(latestInfo),
              bestMoveUci: best?.uci ?? '',
            });
          }
        });

        function cleanup() {
          clearTimeout(timeoutId);
          unsubscribe();
        }

        try {
          sendCommand('setoption name MultiPV value 1');
          sendCommand(`position fen ${fen}`);
          sendCommand(`go movetime ${ANALYSIS_MOVETIME_MS}`);
        } catch (error) {
          cleanup();
          reject(error);
        }
      }),
    [addLineListener, sendCommand],
  );

  const runMultiPvAnalysis = useCallback(
    (fen: string, multipv = 2): Promise<MultiPvAnalysis> =>
      new Promise((resolve, reject) => {
        const latestByMultipv = new Map<number, ReturnType<typeof parseInfoLine>>();
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Stockfish multipv analysis timed out for fen: ${fen}`));
        }, ANALYSIS_MOVETIME_MS + 5_000);

        const unsubscribe = addLineListener((line) => {
          const info = parseInfoLine(line);
          if (info?.multipv != null) {
            latestByMultipv.set(info.multipv, info);
          }

          if (isAnalysisCompleteLine(line)) {
            cleanup();
            sendCommand('setoption name MultiPV value 1');
            resolve({
              fen,
              sideToMove: fenSideToMove(fen),
              lines: [...latestByMultipv.entries()]
                .sort(([a], [b]) => a - b)
                .map(([index, lineInfo]) => ({
                  multipv: index,
                  evalCentipawns: scoreToCentipawns(lineInfo),
                  pv: lineInfo?.pv ?? [],
                })),
            });
          }
        });

        function cleanup() {
          clearTimeout(timeoutId);
          unsubscribe();
        }

        try {
          sendCommand(`setoption name MultiPV value ${multipv}`);
          sendCommand(`position fen ${fen}`);
          sendCommand(`go movetime ${ANALYSIS_MOVETIME_MS}`);
        } catch (error) {
          cleanup();
          reject(error);
        }
      }),
    [addLineListener, sendCommand],
  );

  const drainQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const task = queueRef.current.shift();
        if (task) {
          try {
            await task();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[Move Classification] analysis task failed:', message);
          }
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  const enqueue = useCallback(
    (task: () => Promise<void>) => {
      queueRef.current.push(task);
      void drainQueue();
    },
    [drainQueue],
  );

  const analyzeAndCache = useCallback(
    async (fen: string) => {
      const analysis = await runAnalysis(fen);
      positionAnalysisRef.current = analysis;
      return analysis;
    },
    [runAnalysis],
  );

  const resetClassification = useCallback(() => {
    queueRef.current = [];
    classifiedMovesRef.current = [];
    positionAnalysisRef.current = null;
    gameSanMovesRef.current = [];
    hasLeftBookRef.current = false;
    setLatestClassification(null);
    if (isReady) {
      enqueue(async () => {
        await analyzeAndCache(DEFAULT_POSITION);
      });
    }
  }, [analyzeAndCache, enqueue, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    enqueue(async () => {
      if (!positionAnalysisRef.current) {
        await analyzeAndCache(DEFAULT_POSITION);
      }
    });
  }, [analyzeAndCache, enqueue, isReady]);

  const onMovePlayed = useCallback(
    (move: Move, fenBefore: string) => {
      setLatestClassification(null);
      enqueue(async () => {
        if (!positionAnalysisRef.current) {
          await analyzeAndCache(fenBefore);
        }

        const preMoveAnalysis = positionAnalysisRef.current;
        if (!preMoveAnalysis || preMoveAnalysis.fen !== fenBefore) {
          await analyzeAndCache(fenBefore);
        }

        const beforeAnalysis = positionAnalysisRef.current!;
        const mover = move.color;
        const playedUci = moveToUci(move);
        const evalBefore = evalCentipawnsForMover(beforeAnalysis, mover);
        const wasBestMove = uciMovesMatch(playedUci, beforeAnalysis.bestMoveUci);

        const fenAfter = move.after;
        const afterAnalysis = await analyzeAndCache(fenAfter);
        const evalAfter = evalCentipawnsForMover(afterAnalysis, mover);

        gameSanMovesRef.current.push(move.san);
        const openingBook = getOpeningBook();
        let isBookMove = false;
        if (!hasLeftBookRef.current) {
          isBookMove = openingBook.isSequenceInBook(gameSanMovesRef.current);
          if (!isBookMove) {
            hasLeftBookRef.current = true;
          }
        }

        const materialSacrifice = isMaterialSacrifice(fenBefore, fenAfter, move, mover);
        const brilliantCandidate =
          wasBestMove && materialSacrifice && evalAfter >= 0;

        let winPercentGap = 0;
        if (wasBestMove && !brilliantCandidate) {
          try {
            const multiPv = await runMultiPvAnalysis(fenBefore, 2);
            winPercentGap = bestSecondWinPercentGap(multiPv, mover, centipawnsToWinPercent);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[Move Classification] multipv analysis failed:', message);
          }
        }

        const classification = classifyMove({
          evalBeforeMoveCentipawns: evalBefore,
          evalAfterMoveCentipawns: evalAfter,
          wasBestMove,
          isBookMove,
          isMaterialSacrifice: materialSacrifice,
          bestSecondWinPercentGap: winPercentGap,
        });

        const record: ClassifiedMoveRecord = {
          move: playedUci,
          san: move.san,
          color: mover,
          classification,
          evalBefore,
          evalAfter,
          wasBestMove,
          fenBefore,
          fenAfter,
        };

        classifiedMovesRef.current.push(record);

        setLatestClassification({
          square: move.to,
          classification,
        });

        const tags = [
          isBookMove ? 'book' : null,
          materialSacrifice ? 'sacrifice' : null,
          winPercentGap > 0 ? `gap ${winPercentGap.toFixed(1)}%` : null,
        ]
          .filter(Boolean)
          .join(', ');

        console.log(
          `[Move Classification] ${record.san} (${record.move}): ${record.classification} (before: ${evalBefore}cp, after: ${evalAfter}cp, best: ${wasBestMove ? 'yes' : 'no'}${tags ? `, ${tags}` : ''})`,
        );
      });
    },
    [analyzeAndCache, enqueue, runMultiPvAnalysis],
  );

  return {
    onMovePlayed,
    resetClassification,
    classifiedMovesRef,
    latestClassification,
  };
}
