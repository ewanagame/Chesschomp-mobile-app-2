import { Chess, DEFAULT_POSITION } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

import { classifyPly } from '../lib/classifyPly';
import {
  formatReviewAnalysisError,
  reviewBookStateBeforePly,
} from '../lib/reviewAnalysisError';
import { reviewAnalysisFallbackModes } from '../lib/reviewAnalysisFallback';
import {
  isReusableCachedReview,
  reviewSearchForDepth,
} from '../lib/reviewSettings';
import {
  analysisGoCommand,
  reviewAnalysisTimeoutMs,
  fenSideToMove,
  scoreToCentipawns,
  type AnalysisSearchMode,
  type MultiPvAnalysis,
  type PositionAnalysis,
} from '../lib/stockfishAnalysis';
import { ANALYSIS_CANCELLED, isAnalysisCancelled } from '../lib/stockfishCancel';
import { useStockfishEngine } from '../components/StockfishWebViewEngine';
import { useReviewDepthRef } from '../contexts/AppPreferencesContext';
import type { ClassifiedMoveRecord } from './useMoveClassification';
import { isAnalysisCompleteLine, parseBestMove, parseInfoLine } from '../lib/uciParse';

export type ReviewAnalysisProgress = {
  completed: number;
  total: number;
  phase: 'idle' | 'analyzing' | 'complete' | 'error';
  message: string;
};

type UseGameReviewAnalysisOptions = {
  moves: readonly string[];
  fens: readonly string[];
  savedGameId?: string;
  cachedReview?: {
    depth: number;
    classifiedMoves: ClassifiedMoveRecord[];
    analysisVersion?: number;
  } | null;
  onReviewCached?: (classifiedMoves: ClassifiedMoveRecord[], depth: number) => void;
};

type RunFullAnalysisOptions = {
  resumeFrom?: number;
};

function replayMovesThroughIndex(moves: readonly string[], index: number): Chess {
  const chess = new Chess();
  for (let ply = 0; ply <= index; ply += 1) {
    const san = moves[ply];
    if (!san) {
      break;
    }
    chess.move(san);
  }
  return chess;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('timed out');
}

export function useGameReviewAnalysis({
  moves,
  fens,
  savedGameId,
  cachedReview = null,
  onReviewCached,
}: UseGameReviewAnalysisOptions) {
  const { isReady, sendCommand, addLineListener, registerAnalysisCancel } = useStockfishEngine();
  const reviewDepthRef = useReviewDepthRef();
  const [classifiedMoves, setClassifiedMoves] = useState<readonly ClassifiedMoveRecord[]>([]);
  const classifiedMovesRef = useRef<readonly ClassifiedMoveRecord[]>([]);
  classifiedMovesRef.current = classifiedMoves;
  const [progress, setProgress] = useState<ReviewAnalysisProgress>({
    completed: 0,
    total: moves.length,
    phase: 'idle',
    message: 'Preparing evaluation…',
  });
  const runIdRef = useRef(0);
  const autoRunKeyRef = useRef<string | null>(null);
  const onReviewCachedRef = useRef(onReviewCached);
  onReviewCachedRef.current = onReviewCached;
  const analysisGameKey = `${savedGameId ?? ''}::${moves.join('\n')}::${fens.join('\n')}`;
  const cachedReviewKey = cachedReview
    ? `${cachedReview.depth}::${cachedReview.classifiedMoves.length}`
    : '';

  const runAnalysisOnce = useCallback(
    (fen: string, search: AnalysisSearchMode): Promise<PositionAnalysis> =>
      new Promise((resolve, reject) => {
        let settled = false;
        let sawInfoForThisSearch = false;
        let latestInfo = null as ReturnType<typeof parseInfoLine> | null;
        let drainTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
          drainTimeoutId = setTimeout(() => {
            settle(() => {
              reject(new Error(`Stockfish analysis timed out for fen: ${fen}`));
            });
          }, 1_500);
        }, reviewAnalysisTimeoutMs(search));

        const unsubscribe = addLineListener((line) => {
          const info = parseInfoLine(line);
          if (info && (info.multipv == null || info.multipv === 1)) {
            sawInfoForThisSearch = true;
            latestInfo = info;
          }

          if (isAnalysisCompleteLine(line)) {
            if (!sawInfoForThisSearch) {
              // Stale bestmove from a previous search — ignore.
              return;
            }
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
          if (drainTimeoutId != null) {
            clearTimeout(drainTimeoutId);
          }
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

  const runMultiPvAnalysisOnce = useCallback(
    (fen: string, multipv: number, search: AnalysisSearchMode): Promise<MultiPvAnalysis> =>
      new Promise((resolve, reject) => {
        let settled = false;
        const latestByMultipv = new Map<number, ReturnType<typeof parseInfoLine>>();
        let drainTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
          drainTimeoutId = setTimeout(() => {
            settle(() => {
              reject(new Error(`Stockfish multipv analysis timed out for fen: ${fen}`));
            });
          }, 1_500);
        }, reviewAnalysisTimeoutMs(search));

        const unsubscribe = addLineListener((line) => {
          const info = parseInfoLine(line);
          if (info) {
            latestByMultipv.set(info.multipv ?? 1, info);
          }

          if (isAnalysisCompleteLine(line)) {
            if (latestByMultipv.size === 0) {
              return;
            }
            settle(() => {
              sendCommand('setoption name MultiPV value 1');
              const lines = [...latestByMultipv.entries()]
                .sort(([left], [right]) => left - right)
                .map(([lineMultipv, parsed]) => ({
                  multipv: lineMultipv,
                  evalCentipawns: scoreToCentipawns(parsed),
                  pv: parsed?.pv ?? [],
                  scoreCp: parsed?.scoreCp ?? null,
                  scoreMate: parsed?.scoreMate ?? null,
                }));
              resolve({
                fen,
                sideToMove: fenSideToMove(fen),
                lines,
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
          if (drainTimeoutId != null) {
            clearTimeout(drainTimeoutId);
          }
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

  const runAnalysis = useCallback(
    async (fen: string, search: AnalysisSearchMode): Promise<PositionAnalysis> => {
      const attempts = reviewAnalysisFallbackModes(search);
      let lastError: unknown = null;

      for (const attempt of attempts) {
        try {
          return await runAnalysisOnce(fen, attempt);
        } catch (error) {
          if (isAnalysisCancelled(error)) {
            throw error;
          }
          lastError = error;
          if (!isTimeoutError(error)) {
            throw error;
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
    [runAnalysisOnce],
  );

  const runMultiPvAnalysis = useCallback(
    async (
      fen: string,
      multipv = 2,
      search: AnalysisSearchMode = reviewSearchForDepth(reviewDepthRef.current),
    ): Promise<MultiPvAnalysis> => {
      const attempts = reviewAnalysisFallbackModes(search);
      let lastError: unknown = null;

      for (const attempt of attempts) {
        try {
          return await runMultiPvAnalysisOnce(fen, multipv, attempt);
        } catch (error) {
          if (isAnalysisCancelled(error)) {
            throw error;
          }
          lastError = error;
          if (!isTimeoutError(error)) {
            throw error;
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
    [reviewDepthRef, runMultiPvAnalysisOnce],
  );

  const runFullAnalysis = useCallback(
    async (options?: RunFullAnalysisOptions) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const depth = reviewDepthRef.current;
      const search = reviewSearchForDepth(depth);
      const resumeFrom = Math.max(0, options?.resumeFrom ?? 0);

      if (moves.length === 0) {
        setClassifiedMoves([]);
        setProgress({
          completed: 0,
          total: 0,
          phase: 'complete',
          message: 'Position ready',
        });
        return;
      }

      if (resumeFrom === 0) {
        setClassifiedMoves([]);
        setProgress({
          completed: 0,
          total: moves.length,
          phase: 'analyzing',
          message: 'Analyzing game…',
        });
      } else {
        setProgress({
          completed: resumeFrom,
          total: moves.length,
          phase: 'analyzing',
          message: `Resuming at move ${Math.min(resumeFrom + 1, moves.length)} of ${moves.length}…`,
        });
      }

      const records: ClassifiedMoveRecord[] =
        resumeFrom > 0
          ? [...classifiedMovesRef.current.slice(0, resumeFrom)]
          : [];
      const initialBookState =
        resumeFrom > 0
          ? reviewBookStateBeforePly(moves, resumeFrom)
          : { gameSanMoves: [], hasLeftBook: false };
      let hasLeftBook = initialBookState.hasLeftBook;
      let gameSanMoves = [...initialBookState.gameSanMoves];

      try {
        for (let plyIndex = resumeFrom; plyIndex < moves.length; plyIndex += 1) {
          if (runIdRef.current !== runId) {
            return;
          }

          const chess = replayMovesThroughIndex(moves, plyIndex - 1);
          const fenBefore = plyIndex === 0 ? DEFAULT_POSITION : fens[plyIndex - 1] ?? chess.fen();
          const san = moves[plyIndex]!;
          const move = chess.move(san);
          if (!move) {
            throw new Error(`Unable to replay move: ${san}`);
          }

          const result = await classifyPly(
            { runAnalysis, runMultiPvAnalysis },
            {
              move,
              fenBefore,
              search,
              gameSanMovesBefore: gameSanMoves,
              hasLeftBook,
            },
          );

          records.push(result.record);
          hasLeftBook = result.hasLeftBook;
          gameSanMoves.push(move.san);
          setClassifiedMoves([...records]);

          setProgress({
            completed: plyIndex + 1,
            total: moves.length,
            phase: 'analyzing',
            message: `Analyzing move ${plyIndex + 1} of ${moves.length}…`,
          });
        }

        if (runIdRef.current !== runId) {
          return;
        }

        setClassifiedMoves(records);
        setProgress({
          completed: moves.length,
          total: moves.length,
          phase: 'complete',
          message: 'Evaluation ready',
        });
        onReviewCachedRef.current?.(records, depth);
      } catch (error) {
        if (isAnalysisCancelled(error)) {
          return;
        }
        setClassifiedMoves([...records]);
        setProgress({
          completed: records.length,
          total: moves.length,
          phase: 'error',
          message: formatReviewAnalysisError(error, records.length, moves.length),
        });
      }
    },
    [fens, moves, reviewDepthRef, runAnalysis, runMultiPvAnalysis],
  );

  const runFullAnalysisRef = useRef(runFullAnalysis);
  runFullAnalysisRef.current = runFullAnalysis;

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (savedGameId && moves.length === 0 && fens.length === 0) {
      return;
    }
    if (autoRunKeyRef.current === analysisGameKey) {
      return;
    }
    autoRunKeyRef.current = analysisGameKey;

    if (isReusableCachedReview(cachedReview, moves.length)) {
      setClassifiedMoves(cachedReview.classifiedMoves);
      setProgress({
        completed: moves.length,
        total: moves.length,
        phase: 'complete',
        message: 'Evaluation ready',
      });
      return;
    }

    void runFullAnalysisRef.current();
  }, [analysisGameKey, cachedReview, cachedReviewKey, fens.length, isReady, moves.length, savedGameId]);

  const progressPercent =
    progress.total > 0 ? (progress.completed / progress.total) * 100 : progress.phase === 'complete' ? 100 : 0;

  const rerunAnalysis = useCallback(() => {
    void runFullAnalysisRef.current({ resumeFrom: 0 });
  }, []);

  const resumeAnalysis = useCallback(() => {
    void runFullAnalysisRef.current({
      resumeFrom: classifiedMovesRef.current.length,
    });
  }, []);

  return {
    classifiedMoves,
    progress,
    progressPercent,
    rerunAnalysis,
    resumeAnalysis,
    isReady,
  };
}
