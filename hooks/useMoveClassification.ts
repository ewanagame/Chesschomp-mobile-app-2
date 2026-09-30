import type { Move } from 'chess.js';
import { DEFAULT_POSITION, type Square } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isAnalysisCompleteLine, parseBestMove, parseInfoLine } from '../lib/uciParse';
import { classifyPly } from '../lib/classifyPly';
import { isForcedMove } from '../lib/forcedMove';
import {
  analysisGoCommand,
  analysisTimeoutMs,
  bestSecondWinPercentGap,
  evalCentipawnsForMover,
  fenSideToMove,
  LIVE_EVAL_SEARCH,
  liveEvalFromAnalysis,
  movetimeSearch,
  moveToUci,
  scoreToCentipawns,
  uciMovesMatch,
  type AnalysisSearchMode,
  type MultiPvAnalysis,
  type PositionAnalysis,
} from '../lib/stockfishAnalysis';
import { ANALYSIS_CANCELLED, isAnalysisCancelled } from '../lib/stockfishCancel';
import { useStockfishEngine } from '../components/StockfishWebViewEngine';
import { useClassificationMovetimeMsRef } from '../contexts/AppPreferencesContext';
import {
  centipawnsToWinPercent,
  classifyMove,
  meetsBrilliantEvalThreshold,
  type MoveClassification,
} from '../utils/moveClassification';
import { getOpeningBook } from '../lib/openingBook';
import { NEUTRAL_POSITION_EVAL, type LivePositionEval } from '../lib/liveEval';
import { getTerminalPositionAnalysis } from '../lib/terminalPosition';
import type { EasterEggCandidate } from '../lib/easterEggMovePreview';
import { alignClassifiedMovesToSans } from '../lib/classifiedMoves';
import { movesThroughIndex, toFen, type GameSession } from '../lib/gameHistory';

export type ClassifiedMoveRecord = {
  move: string;
  san: string;
  color: 'w' | 'b';
  classification: MoveClassification;
  evalBefore: number;
  evalAfter: number;
  /** Mate distance from White's perspective after this move, when applicable. */
  mateInWhiteAfter?: number | null;
  wasBestMove: boolean;
  bestMoveUci?: string;
  fenBefore: string;
  fenAfter: string;
  forced?: boolean;
  missedWin?: boolean;
  missedWinDetail?: string | null;
  bestMoveEval?: number | null;
  evalDelta?: number | null;
};

export type LatestMoveClassification = {
  from: Square;
  square: Square;
  classification: MoveClassification;
  missedWin?: boolean;
};

export function useMoveClassification(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const {
    isReady,
    isBridgeConnected,
    sendCommand,
    addLineListener,
    registerAnalysisCancel,
    pauseEngine,
  } = useStockfishEngine();
  const classificationMovetimeMsRef = useClassificationMovetimeMsRef();

  const positionAnalysisRef = useRef<PositionAnalysis | null>(null);
  const classifiedMovesRef = useRef<ClassifiedMoveRecord[]>([]);
  const queueRef = useRef<Array<() => Promise<void>>>([]);
  const processingRef = useRef(false);
  const inFlightCancelRef = useRef<(() => void) | null>(null);
  const movePlayedWaitersRef = useRef(new Set<() => void>());
  const [isAnalysisIdle, setIsAnalysisIdle] = useState(true);
  const [latestClassification, setLatestClassification] = useState<LatestMoveClassification | null>(
    null,
  );
  const [positionEval, setPositionEval] = useState<LivePositionEval>(NEUTRAL_POSITION_EVAL);
  const gameSanMovesRef = useRef<string[]>([]);
  const hasLeftBookRef = useRef(false);
  const analysisGenerationRef = useRef(0);

  const abortInFlightQueueTask = useCallback(() => {
    inFlightCancelRef.current?.();
    inFlightCancelRef.current = null;
  }, []);

  const resolveMovePlayedWaiters = useCallback(() => {
    const waiters = movePlayedWaitersRef.current;
    if (waiters.size === 0) {
      return;
    }
    movePlayedWaitersRef.current = new Set();
    for (const resolve of waiters) {
      resolve();
    }
  }, []);

  const abortPendingAnalysis = useCallback(() => {
    analysisGenerationRef.current += 1;
    abortInFlightQueueTask();
    queueRef.current = [];
    resolveMovePlayedWaiters();
    if (!enabledRef.current) {
      return;
    }
    pauseEngine();
  }, [abortInFlightQueueTask, pauseEngine, resolveMovePlayedWaiters]);

  const runAnalysis = useCallback(
    (fen: string, search: AnalysisSearchMode = LIVE_EVAL_SEARCH): Promise<PositionAnalysis> =>
      new Promise((resolve, reject) => {
        let settled = false;
        let latestInfo = null as ReturnType<typeof parseInfoLine> | null;

        function settle(onSettle: () => void) {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          onSettle();
        }

        const timeoutId = setTimeout(() => {
          try {
            sendCommand('stop');
          } catch {
            // Engine may already be stopping.
          }
          settle(() => {
            reject(new Error(`Stockfish analysis timed out for fen: ${fen}`));
          });
        }, analysisTimeoutMs(search));

        const unsubscribe = addLineListener((line) => {
          const info = parseInfoLine(line);
          if (info && (info.multipv == null || info.multipv === 1)) {
            latestInfo = info;
          }

          if (isAnalysisCompleteLine(line)) {
            const best = parseBestMove(line);
            settle(() => {
              resolve({
                fen,
                sideToMove: fenSideToMove(fen),
                evalCentipawns: scoreToCentipawns(latestInfo),
                bestMoveUci: best?.uci ?? '',
                scoreCp: latestInfo?.scoreCp ?? null,
                scoreMate: latestInfo?.scoreMate ?? null,
              });
            });
          }
        });

        const unregisterCancel = registerAnalysisCancel(() => {
          settle(() => {
            reject(new Error(ANALYSIS_CANCELLED));
          });
        });

        function cleanup() {
          clearTimeout(timeoutId);
          unsubscribe();
          unregisterCancel();
        }

        try {
          sendCommand('setoption name MultiPV value 1');
          sendCommand(`position fen ${fen}`);
          sendCommand(analysisGoCommand(search));
        } catch (error) {
          settle(() => {
            reject(error instanceof Error ? error : new Error(String(error)));
          });
        }
      }),
    [addLineListener, registerAnalysisCancel, sendCommand],
  );

  const runMultiPvAnalysis = useCallback(
    (fen: string, multipv = 2, search: AnalysisSearchMode = LIVE_EVAL_SEARCH): Promise<MultiPvAnalysis> =>
      new Promise((resolve, reject) => {
        let settled = false;
        const latestByMultipv = new Map<number, ReturnType<typeof parseInfoLine>>();

        function settle(onSettle: () => void) {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          onSettle();
        }

        const timeoutId = setTimeout(() => {
          try {
            sendCommand('stop');
          } catch {
            // Engine may already be stopping.
          }
          settle(() => {
            reject(new Error(`Stockfish multipv analysis timed out for fen: ${fen}`));
          });
        }, analysisTimeoutMs(search));

        const unsubscribe = addLineListener((line) => {
          const info = parseInfoLine(line);
          if (info?.multipv != null) {
            latestByMultipv.set(info.multipv, info);
          }

          if (isAnalysisCompleteLine(line)) {
            settle(() => {
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
                    scoreCp: lineInfo?.scoreCp ?? null,
                    scoreMate: lineInfo?.scoreMate ?? null,
                  })),
              });
            });
          }
        });

        const unregisterCancel = registerAnalysisCancel(() => {
          settle(() => {
            reject(new Error(ANALYSIS_CANCELLED));
          });
        });

        function cleanup() {
          clearTimeout(timeoutId);
          unsubscribe();
          unregisterCancel();
        }

        try {
          sendCommand(`setoption name MultiPV value ${multipv}`);
          sendCommand(`position fen ${fen}`);
          sendCommand(analysisGoCommand(search));
        } catch (error) {
          settle(() => {
            reject(error instanceof Error ? error : new Error(String(error)));
          });
        }
      }),
    [addLineListener, registerAnalysisCancel, sendCommand],
  );

  const drainQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const task = queueRef.current.shift();
        if (!task) {
          continue;
        }

        try {
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const finish = (callback: () => void) => {
              if (settled) {
                return;
              }
              settled = true;
              inFlightCancelRef.current = null;
              callback();
            };

            inFlightCancelRef.current = () => {
              finish(() => {
                reject(new Error(ANALYSIS_CANCELLED));
              });
            };

            void task().then(
              () => {
                finish(resolve);
              },
              (error) => {
                finish(() => {
                  reject(error instanceof Error ? error : new Error(String(error)));
                });
              },
            );
          });
        } catch (error) {
          if (!isAnalysisCancelled(error)) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[Move Classification] analysis task failed:', message);
          }
        }
      }
    } finally {
      processingRef.current = false;
      inFlightCancelRef.current = null;
      if (queueRef.current.length === 0) {
        setIsAnalysisIdle(true);
      } else {
        void drainQueue();
      }
    }
  }, []);

  const enqueue = useCallback(
    (task: () => Promise<void>) => {
      setIsAnalysisIdle(false);
      queueRef.current.push(task);
      void drainQueue();
    },
    [drainQueue],
  );

  const analyzeAndCache = useCallback(
    async (fen: string) => {
      const terminal = getTerminalPositionAnalysis(fen);
      if (terminal) {
        positionAnalysisRef.current = terminal;
        return terminal;
      }

      const analysis = await runAnalysis(fen);
      positionAnalysisRef.current = analysis;
      return analysis;
    },
    [runAnalysis],
  );

  const requestBestMove = useCallback(
    (fen: string, options?: { forceRefresh?: boolean }): Promise<string | null> =>
      new Promise((resolve, reject) => {
        enqueue(async () => {
          try {
            const sideToMove = fenSideToMove(fen);
            const cached = positionAnalysisRef.current;
            if (
              !options?.forceRefresh &&
              cached?.fen === fen &&
              cached.sideToMove === sideToMove &&
              cached.bestMoveUci
            ) {
              resolve(cached.bestMoveUci);
              return;
            }

            const analysis = await runAnalysis(fen);
            positionAnalysisRef.current = analysis;
            resolve(analysis.bestMoveUci || null);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }),
    [enqueue, runAnalysis],
  );

  const getCachedPositionAnalysis = useCallback(
    (): PositionAnalysis | null => positionAnalysisRef.current,
    [],
  );

  const runMoveClassificationPreview = useCallback(
    (
      fenBefore: string,
      candidate: EasterEggCandidate,
      isCancelled: () => boolean,
    ): Promise<'Brilliant' | 'Great' | null> =>
      new Promise((resolve, reject) => {
        enqueue(async () => {
          try {
            if (isCancelled()) {
              resolve(null);
              return;
            }

            let beforeAnalysis = positionAnalysisRef.current;
            if (!beforeAnalysis || beforeAnalysis.fen !== fenBefore) {
              beforeAnalysis = await analyzeAndCache(fenBefore);
            }

            if (isCancelled()) {
              resolve(null);
              return;
            }

            const mover = candidate.move.color;
            const evalBefore = evalCentipawnsForMover(beforeAnalysis, mover);

            if (isForcedMove(fenBefore)) {
              resolve(null);
              return;
            }

            const afterAnalysis = await runAnalysis(candidate.move.after);
            if (isCancelled()) {
              resolve(null);
              return;
            }

            const evalAfter = evalCentipawnsForMover(afterAnalysis, mover);

            const openingBook = getOpeningBook();
            let isBookMove = false;
            if (!hasLeftBookRef.current) {
              isBookMove = openingBook.isSequenceInBook([
                ...gameSanMovesRef.current,
                candidate.move.san,
              ]);
            }

            const brilliantCandidate =
              candidate.isMaterialSacrifice && meetsBrilliantEvalThreshold(evalAfter);

            let winPercentGap = 0;
            if (!brilliantCandidate) {
              const multiPv = await runMultiPvAnalysis(fenBefore, 2);
              if (isCancelled()) {
                resolve(null);
                return;
              }
              winPercentGap = bestSecondWinPercentGap(multiPv, mover, centipawnsToWinPercent);
            }

            const classification = classifyMove({
              evalBeforeMoveCentipawns: evalBefore,
              evalAfterMoveCentipawns: evalAfter,
              wasBestMove: true,
              isBookMove,
              isMaterialSacrifice: candidate.isMaterialSacrifice,
              bestSecondWinPercentGap: winPercentGap,
              isForcedMove: false,
            });

            if (classification === 'Brilliant' || classification === 'Great') {
              resolve(classification);
              return;
            }

            resolve(null);
          } catch (error) {
            if (isAnalysisCancelled(error)) {
              resolve(null);
              return;
            }
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }),
    [analyzeAndCache, enqueue, runAnalysis, runMultiPvAnalysis],
  );

  const restoreClassifiedMoves = useCallback((records: readonly ClassifiedMoveRecord[]) => {
    classifiedMovesRef.current = records.map((record) => ({ ...record }));
  }, []);

  const resetClassification = useCallback(() => {
    abortPendingAnalysis();
    classifiedMovesRef.current = [];
    positionAnalysisRef.current = null;
    gameSanMovesRef.current = [];
    hasLeftBookRef.current = false;
    setIsAnalysisIdle(true);
    setLatestClassification(null);
    setPositionEval(NEUTRAL_POSITION_EVAL);
    if (enabledRef.current && isBridgeConnected) {
      enqueue(async () => {
        await analyzeAndCache(DEFAULT_POSITION);
      });
    }
  }, [abortPendingAnalysis, analyzeAndCache, enqueue, isBridgeConnected]);

  const syncBookStateAfterUndo = useCallback(() => {
    const openingBook = getOpeningBook();
    const moves = gameSanMovesRef.current;
    hasLeftBookRef.current =
      moves.length > 0 && !openingBook.isSequenceInBook(moves);
  }, []);

  const applyPositionEvalFromAnalysis = useCallback((analysis: PositionAnalysis) => {
    positionAnalysisRef.current = analysis;
    const liveEval = liveEvalFromAnalysis(analysis);
    setPositionEval({
      isNeutral: false,
      centipawnsWhite: liveEval.centipawnsWhite,
      mateInWhite: liveEval.mateInWhite,
    });
  }, []);

  const trimAnalysisToPlyCount = useCallback(
    (plyCount: number) => {
      classifiedMovesRef.current = classifiedMovesRef.current.slice(0, plyCount);
      gameSanMovesRef.current = gameSanMovesRef.current.slice(0, plyCount);
      syncBookStateAfterUndo();
    },
    [syncBookStateAfterUndo],
  );

  /** Rebuild analysis/classification refs and re-sync Stockfish to the session index. */
  const syncAnalysisToSession = useCallback(
    (session: GameSession) => {
      abortPendingAnalysis();

      const replayedMoves = movesThroughIndex(session);
      gameSanMovesRef.current = [...replayedMoves];
      classifiedMovesRef.current = alignClassifiedMovesToSans(
        classifiedMovesRef.current,
        session.moves,
      );
      syncBookStateAfterUndo();
      setLatestClassification(null);
      positionAnalysisRef.current = null;

      if (!enabledRef.current) {
        setIsAnalysisIdle(true);
        return;
      }

      const fen = toFen(session);
      const terminal = getTerminalPositionAnalysis(fen);
      if (terminal) {
        applyPositionEvalFromAnalysis(terminal);
        setIsAnalysisIdle(true);
        return;
      }

      if (!isBridgeConnected) {
        setPositionEval(NEUTRAL_POSITION_EVAL);
        setIsAnalysisIdle(true);
        return;
      }

      setIsAnalysisIdle(false);
      const generation = analysisGenerationRef.current;
      enqueue(async () => {
        const analysis = await runAnalysis(fen);
        if (generation !== analysisGenerationRef.current) {
          return;
        }

        applyPositionEvalFromAnalysis(analysis);
        setIsAnalysisIdle(true);
      });
    },
    [
      abortPendingAnalysis,
      applyPositionEvalFromAnalysis,
      enqueue,
      isBridgeConnected,
      runAnalysis,
      syncBookStateAfterUndo,
    ],
  );

  useEffect(() => {
    return () => {
      abortPendingAnalysis();
    };
  }, [abortPendingAnalysis]);

  useEffect(() => {
    if (!isReady || !enabled) {
      return;
    }
    enqueue(async () => {
      if (!positionAnalysisRef.current) {
        await analyzeAndCache(DEFAULT_POSITION);
      }
    });
  }, [analyzeAndCache, enabled, enqueue, isReady]);

  const onMovePlayed = useCallback(
    (move: Move, fenBefore: string): Promise<void> => {
      setLatestClassification(null);
      const generation = analysisGenerationRef.current;
      return new Promise((resolve) => {
        const finish = () => {
          movePlayedWaitersRef.current.delete(finish);
          resolve();
        };
        movePlayedWaitersRef.current.add(finish);

        enqueue(async () => {
          try {
            if (generation !== analysisGenerationRef.current) {
              return;
            }

            const search = movetimeSearch(classificationMovetimeMsRef.current);
            const result = await classifyPly(
              { runAnalysis, runMultiPvAnalysis },
              {
                move,
                fenBefore,
                search,
                gameSanMovesBefore: gameSanMovesRef.current,
                hasLeftBook: hasLeftBookRef.current,
              },
            );

            if (generation !== analysisGenerationRef.current) {
              return;
            }

            const { record, afterAnalysis } = result;
            hasLeftBookRef.current = result.hasLeftBook;
            gameSanMovesRef.current.push(move.san);
            classifiedMovesRef.current.push(record);
            applyPositionEvalFromAnalysis(afterAnalysis);

            setLatestClassification({
              from: move.from,
              square: move.to,
              classification: record.classification,
              missedWin: record.missedWin,
            });

            const displayLabel = record.missedWin
              ? `${record.classification} + Missed Win`
              : record.classification;

            console.log(
              `[Move Classification] ${record.san} (${record.move}): ${displayLabel} (before: ${record.evalBefore}cp, after: ${record.evalAfter}cp, best: ${record.wasBestMove ? 'yes' : 'no'}${record.missedWinDetail ? `, ${record.missedWinDetail}` : ''})`,
            );
          } catch (error) {
            if (!isAnalysisCancelled(error)) {
              const message = error instanceof Error ? error.message : String(error);
              console.warn('[Move Classification] move classification failed:', message);
            }
          } finally {
            finish();
          }
        });
      });
    },
    [applyPositionEvalFromAnalysis, enqueue, runAnalysis, runMultiPvAnalysis],
  );

  return {
    onMovePlayed,
    syncAnalysisToSession,
    trimAnalysisToPlyCount,
    restoreClassifiedMoves,
    resetClassification,
    classifiedMovesRef,
    latestClassification,
    positionEval,
    isAnalysisIdle,
    isEngineReady: isReady,
    enqueueEngineTask: enqueue,
    requestBestMove,
    getCachedPositionAnalysis,
    runMoveClassificationPreview,
  };
}
