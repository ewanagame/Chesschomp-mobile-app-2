import type { Move } from 'chess.js';
import { DEFAULT_POSITION, type Square } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isAnalysisCompleteLine, parseBestMove, parseInfoLine } from '../lib/uciParse';
import {
  ANALYSIS_MOVETIME_MS,
  evalCentipawnsForMover,
  fenSideToMove,
  moveToUci,
  scoreToCentipawns,
  uciMovesMatch,
  type PositionAnalysis,
} from '../lib/stockfishAnalysis';
import { useStockfishEngine } from '../components/StockfishWebViewEngine';
import { classifyMove, type MoveClassification } from '../utils/moveClassification';
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
          if (info) {
            latestInfo = info;
          }

          if (isAnalysisCompleteLine(line)) {
            const best = parseBestMove(line);
            const isTerminal = line.includes('(none)');
            // #region agent log
            fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'mate-fix',hypothesisId:'H1',location:'useMoveClassification.ts:runAnalysis',message:'analysis complete',data:{fen,isTerminal,bestMove:best?.uci??null,scoreMate:latestInfo?.scoreMate??null,scoreCp:latestInfo?.scoreCp??null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
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
            // #region agent log
            fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'mate-fix',hypothesisId:'H2',location:'useMoveClassification.ts:drainQueue',message:'task failed',data:{error:message},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
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

        const classification = classifyMove({
          evalBeforeMoveCentipawns: evalBefore,
          evalAfterMoveCentipawns: evalAfter,
          wasBestMove,
          isBookMove,
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

        console.log(
          `[Move Classification] ${record.san} (${record.move}): ${record.classification} (before: ${evalBefore}cp, after: ${evalAfter}cp, best: ${wasBestMove ? 'yes' : 'no'}${isBookMove ? ', book' : ''})`,
        );
      });
    },
    [analyzeAndCache, enqueue],
  );

  return {
    onMovePlayed,
    resetClassification,
    classifiedMovesRef,
    latestClassification,
  };
}
