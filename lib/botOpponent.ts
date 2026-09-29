import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

import { botMoveUsesStockfish, getEloCalibration, MATERIAL_EVAL_ELO_THRESHOLD, type EloCalibration } from './botEloCalibration';
import { chooseTier600Move, moveToBotMove, rankMaterialMoves, type RankedBotMove } from './botMaterialSearch';
import { pickOpeningBookMove } from './botOpeningBook';
import type { Bot } from './bots';
import { chooseLosingBotMove, moveAllowsFreeCapture } from './losingBotOpponent';
import { ANALYSIS_CANCELLED, isAnalysisCancelled, type RegisterAnalysisCancel } from './stockfishCancel';
import { scoreToCentipawns } from './stockfishAnalysis';
import {
  applyBotStrengthOptions,
  botMoveKey,
  restoreAnalysisStrengthOptions,
  type BotStrengthOverrides,
} from './stockfishStrength';
import { getEndgameConversionCalibration } from './endgameConversion';
import { isAnalysisCompleteLine, parseBestMove, parseInfoLine } from './uciParse';

export const BOT_MOVE_REVEAL_DELAY_MIN_MS = 1500;
export const BOT_MOVE_REVEAL_DELAY_RANGE_MS = 500;

export type BotMove = {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
};

function uciToBotMove(uci: string): BotMove {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
  };
}

export function pickRandomLegalMove(fen: string): BotMove | null {
  const position = new Chess(fen);
  const moves = position.moves({ verbose: true });
  if (moves.length === 0) {
    return null;
  }

  const move = moves[Math.floor(Math.random() * moves.length)];
  return moveToBotMove(move);
}

function pickRandomFromRanked(ranked: RankedBotMove[]): BotMove {
  const entry = ranked[Math.floor(Math.random() * ranked.length)];
  return entry.move;
}

function pickSuboptimalFromRanked(
  fen: string,
  ranked: RankedBotMove[],
  botColor: Color,
  blunderSeverity: number,
): BotMove {
  if (ranked.length <= 1) {
    return ranked[0]?.move ?? pickRandomLegalMove(fen)!;
  }

  const alternatives = ranked.slice(1);
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });

  if (blunderSeverity < 0.35) {
    const hangingMoves = legalMoves.filter((move) => moveAllowsFreeCapture(fen, move, botColor));
    if (hangingMoves.length > 0) {
      return moveToBotMove(hangingMoves[Math.floor(Math.random() * hangingMoves.length)]);
    }

    if (Math.random() < 0.45) {
      return pickRandomFromRanked(alternatives);
    }

    const worstCount = Math.max(1, Math.ceil(ranked.length / 3));
    return pickRandomFromRanked(ranked.slice(-worstCount));
  }

  if (blunderSeverity < 0.75) {
    const maxRank = Math.max(2, Math.round(2 + (1 - blunderSeverity) * 5));
    const pool = ranked.slice(1, Math.min(maxRank + 1, ranked.length));
    return pickRandomFromRanked(pool.length > 0 ? pool : alternatives);
  }

  const secondScore = ranked[1].score;
  const inaccuracyPool = ranked.filter(
    (entry, index) => index > 0 && entry.score >= secondScore - 25,
  );
  return pickRandomFromRanked(inaccuracyPool.length > 0 ? inaccuracyPool : alternatives);
}

/** Chance that severe-tier bots (blunderSeverity < 0.35) take a hanging move when one exists. */
const SEVERE_TIER_HANG_CHANCE = 0.55;

const SEVERITY_SCALE_MIN = 25;
const SEVERITY_SCALE_SPAN = 140;

function severityScaleFromBlunderSeverity(blunderSeverity: number): number {
  return SEVERITY_SCALE_MIN + (1 - blunderSeverity) * SEVERITY_SCALE_SPAN;
}

function pickWeightedFromScoredAlternatives(
  weighted: { entry: RankedBotMove; weight: number }[],
): BotMove {
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return pickRandomFromRanked(weighted.map((item) => item.entry));
  }

  let roll = Math.random() * totalWeight;
  for (const { entry, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      return entry.move;
    }
  }

  return weighted[weighted.length - 1].entry.move;
}

/**
 * Suboptimal move pick weighted by centipawn loss (exponential decay).
 * Severe-tier bots may still prefer material hangs before falling back to weights.
 */
function pickSuboptimalFromRankedWeighted(
  fen: string,
  ranked: RankedBotMove[],
  botColor: Color,
  blunderSeverity: number,
): BotMove {
  if (ranked.length <= 1) {
    return ranked[0]?.move ?? pickRandomLegalMove(fen)!;
  }

  if (blunderSeverity < 0.35) {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });
    const hangingMoves = legalMoves.filter((move) => moveAllowsFreeCapture(fen, move, botColor));
    if (hangingMoves.length > 0 && Math.random() < SEVERE_TIER_HANG_CHANCE) {
      return moveToBotMove(hangingMoves[Math.floor(Math.random() * hangingMoves.length)]);
    }
  }

  const bestScore = ranked[0].score;
  const severityScale = severityScaleFromBlunderSeverity(blunderSeverity);
  const weightedAlternatives = ranked.slice(1).map((entry) => {
    const lineLoss = Math.max(0, bestScore - entry.score);
    const weight = Math.exp(-lineLoss / severityScale);
    return { entry, weight };
  });

  return pickWeightedFromScoredAlternatives(weightedAlternatives);
}

function computeMultipv(calibration: EloCalibration, legalMoveCount: number): number {
  if (calibration.blunderSeverity > 0.85) {
    return Math.min(3, legalMoveCount);
  }
  if (calibration.blunderSeverity > 0.5) {
    return Math.min(5, legalMoveCount);
  }
  return Math.min(8, legalMoveCount);
}

function runStockfishRankedSearch(
  fen: string,
  calibration: EloCalibration,
  multipv: number,
  sendCommand: (command: string) => void,
  addLineListener: (listener: (line: string) => void) => () => void,
  registerAnalysisCancel: RegisterAnalysisCancel,
  strengthOverrides?: BotStrengthOverrides,
): Promise<RankedBotMove[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const latestByMultipv = new Map<number, ReturnType<typeof parseInfoLine>>();
    const timeoutMs = calibration.stockfishSearchDepth * 450 + 3_000;

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
        reject(new Error(`Calibrated bot search timed out for fen: ${fen}`));
      });
    }, timeoutMs);

    const unsubscribe = addLineListener((line) => {
      const info = parseInfoLine(line);
      if (info?.multipv != null) {
        latestByMultipv.set(info.multipv, info);
      }

      if (isAnalysisCompleteLine(line)) {
        settle(() => {
          sendCommand('setoption name MultiPV value 1');
          restoreAnalysisStrengthOptions(sendCommand);

          const rankedFromMultipv = [...latestByMultipv.entries()]
            .sort(([a], [b]) => a - b)
            .flatMap(([, lineInfo]) => {
              const pvMove = lineInfo?.pv?.[0];
              if (!pvMove) {
                return [];
              }

              const evalCentipawns = scoreToCentipawns(lineInfo);
              const noise =
                calibration.evalNoise > 0
                  ? (Math.random() * 2 - 1) * calibration.evalNoise
                  : 0;

              return [
                {
                  move: uciToBotMove(pvMove),
                  score: evalCentipawns + noise,
                },
              ];
            })
            .sort((a, b) => b.score - a.score);

          const best = parseBestMove(line);
          if (!best?.uci) {
            resolve(rankedFromMultipv);
            return;
          }

          const skillLimitedMove = uciToBotMove(best.uci);
          const skillKey = botMoveKey(skillLimitedMove);
          const matching = rankedFromMultipv.find((entry) => botMoveKey(entry.move) === skillKey);
          const alternatives = rankedFromMultipv.filter(
            (entry) => botMoveKey(entry.move) !== skillKey,
          );

          resolve([
            {
              move: skillLimitedMove,
              score: matching?.score ?? rankedFromMultipv[0]?.score ?? 0,
            },
            ...alternatives,
          ]);
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
      restoreAnalysisStrengthOptions(sendCommand);
    }

    try {
      applyBotStrengthOptions(sendCommand, calibration, strengthOverrides);
      sendCommand(`setoption name MultiPV value ${multipv}`);
      sendCommand(`position fen ${fen}`);
      sendCommand(`go depth ${calibration.stockfishSearchDepth}`);
    } catch (error) {
      settle(() => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    }
  });
}

/** Fallback when MultiPV returns nothing — single bestmove via movetime search. */
function runStockfishBestMoveSearch(
  fen: string,
  calibration: EloCalibration,
  sendCommand: (command: string) => void,
  addLineListener: (listener: (line: string) => void) => () => void,
  registerAnalysisCancel: RegisterAnalysisCancel,
  strengthOverrides?: BotStrengthOverrides,
): Promise<BotMove | null> {
  return new Promise((resolve, reject) => {
    let settled = false;

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
        reject(new Error(`Calibrated bot fallback search timed out for fen: ${fen}`));
      });
    }, calibration.stockfishMovetimeMs + 3_000);

    const unsubscribe = addLineListener((line) => {
      if (!isAnalysisCompleteLine(line)) {
        return;
      }

      const best = parseBestMove(line);
      settle(() => {
        restoreAnalysisStrengthOptions(sendCommand);
        resolve(best ? uciToBotMove(best.uci) : null);
      });
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
      restoreAnalysisStrengthOptions(sendCommand);
    }

    try {
      applyBotStrengthOptions(sendCommand, calibration, strengthOverrides);
      sendCommand(`position fen ${fen}`);
      sendCommand(`go movetime ${calibration.stockfishMovetimeMs}`);
    } catch (error) {
      settle(() => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    }
  });
}

export async function runCalibratedBotSearch(
  fen: string,
  calibration: EloCalibration,
  sendCommand: (command: string) => void,
  addLineListener: (listener: (line: string) => void) => () => void,
  registerAnalysisCancel: RegisterAnalysisCancel,
): Promise<BotMove | null> {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[Bot Move] runCalibratedBotSearch', {
      elo: calibration.elo,
      useMaterialOnlyEval: calibration.useMaterialOnlyEval,
      searchDepth: calibration.searchDepth,
      stockfishSearchDepth: calibration.stockfishSearchDepth,
    });
  }

  const chess = new Chess(fen);
  const botColor = chess.turn();
  const legalMoves = chess.moves({ verbose: true });

  if (legalMoves.length === 0) {
    return null;
  }

  if (legalMoves.length === 1) {
    return moveToBotMove(legalMoves[0]);
  }

  if (calibration.useMaterialOnlyEval) {
    const playBest = Math.random() < calibration.bestMoveProbability;
    const ranked = rankMaterialMoves(
      fen,
      calibration.searchDepth,
      botColor,
      calibration.evalNoise,
    );

    if (ranked.length === 0) {
      return pickRandomLegalMove(fen);
    }

    if (playBest) {
      return ranked[0].move;
    }

    return pickSuboptimalFromRanked(fen, ranked, botColor, calibration.blunderSeverity);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[Bot Move] entering Stockfish search path', calibration);
  }

  const endgameConversion = getEndgameConversionCalibration(fen, botColor, calibration);
  const searchCalibration = endgameConversion.calibration;
  const strengthOverrides = endgameConversion.strengthOverrides;

  if (typeof __DEV__ !== 'undefined' && __DEV__ && endgameConversion.active) {
    console.log('[Bot Move] endgame conversion scaling', {
      elo: calibration.elo,
      effectiveBlend: endgameConversion.effectiveBlend,
      uciElo: strengthOverrides?.uciElo,
      bestMoveProbability: searchCalibration.bestMoveProbability,
      stockfishSearchDepth: searchCalibration.stockfishSearchDepth,
      evalNoise: searchCalibration.evalNoise,
    });
  }

  const multipv = computeMultipv(searchCalibration, legalMoves.length);
  const playBestRate = searchCalibration.bestMoveProbability;
  const playBest = Math.random() < playBestRate;

  try {
    const ranked = await runStockfishRankedSearch(
      fen,
      searchCalibration,
      multipv,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
      strengthOverrides,
    );

    if (ranked.length === 0) {
      const fallback = await runStockfishBestMoveSearch(
        fen,
        searchCalibration,
        sendCommand,
        addLineListener,
        registerAnalysisCancel,
        strengthOverrides,
      );
      return fallback ?? pickRandomLegalMove(fen);
    }

    if (playBest) {
      return ranked[0].move;
    }

    return pickSuboptimalFromRanked(
      fen,
      ranked,
      botColor,
      searchCalibration.blunderSeverity,
    );
  } catch (error) {
    if (isAnalysisCancelled(error)) {
      throw error;
    }

    const fallback = await runStockfishBestMoveSearch(
      fen,
      searchCalibration,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
      strengthOverrides,
    ).catch((fallbackError) => {
      if (isAnalysisCancelled(fallbackError)) {
        throw fallbackError;
      }
      return null;
    });

    return fallback ?? pickRandomLegalMove(fen);
  }
}

export async function chooseBotMove(
  fen: string,
  bot: Pick<Bot, 'elo' | 'behavior'>,
  sanMoves: readonly string[],
  sendCommand: (command: string) => void,
  addLineListener: (listener: (line: string) => void) => () => void,
  registerAnalysisCancel: RegisterAnalysisCancel,
): Promise<BotMove | null> {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const calibration = getEloCalibration(bot.elo);
    console.log('[Bot Move] chooseBotMove', {
      behavior: bot.behavior,
      elo: bot.elo,
      useMaterialOnlyEval: calibration.useMaterialOnlyEval,
      materialThreshold: MATERIAL_EVAL_ELO_THRESHOLD,
      usesStockfish: botMoveUsesStockfish(bot),
    });
  }

  if (bot.behavior === 'losing') {
    // Losing bots never use book knowledge — always eval-search for the worst move, even move 1.
    return chooseLosingBotMove(fen, sendCommand, addLineListener, registerAnalysisCancel);
  }

  const bookMove = pickOpeningBookMove(fen, sanMoves);
  if (bookMove) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[Bot Move] opening book move', bookMove);
    }
    return bookMove;
  }

  if (bot.behavior === 'tier600') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[Bot Move] tier600 material-only path');
    }
    return chooseTier600Move(fen);
  }

  const calibration = getEloCalibration(bot.elo);
  return runCalibratedBotSearch(
    fen,
    calibration,
    sendCommand,
    addLineListener,
    registerAnalysisCancel,
  );
}

export { botMoveUsesStockfish } from './botEloCalibration';

export function botColorForPlayer(playerColor: Color): Color {
  return playerColor === 'w' ? 'b' : 'w';
}

/** Wait until the latest board state has had a chance to paint. */
export function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Randomized human-feel pause before revealing each bot move (1.5–2.0s). */
export function pickBotMoveRevealDelayMs(): number {
  return Math.random() * BOT_MOVE_REVEAL_DELAY_RANGE_MS + BOT_MOVE_REVEAL_DELAY_MIN_MS;
}

/** Enforces the minimum bot-move reveal delay from a start timestamp. */
export function waitForBotMoveRevealDelay(startedAt: number): Promise<void> {
  const delayMs = pickBotMoveRevealDelayMs();
  const remaining = delayMs - (Date.now() - startedAt);
  if (remaining <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, remaining));
}
