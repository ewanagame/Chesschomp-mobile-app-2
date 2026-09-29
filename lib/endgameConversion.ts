import { Chess, type Color } from 'chess.js';

import {
  ELO_MAX,
  ELO_MIN,
  type EloCalibration,
} from './botEloCalibration';
import {
  countMaterial,
} from './materialEval';
import {
  STOCKFISH_UCI_ELO_MAX,
  STOCKFISH_UCI_ELO_MIN,
  stockfishUciEloFromBotElo,
  type BotStrengthOverrides,
} from './stockfishStrength';

/** Max Stockfish search depth during trivial winning-endgame conversion. */
export const ENDGAME_CONVERSION_MAX_SEARCH_DEPTH = 18;

/** Same log-scaled progress as getEloCalibration(). */
export function eloProgress(elo: number): number {
  const clamped = Math.min(ELO_MAX, Math.max(ELO_MIN, elo));
  return Math.log(clamped / ELO_MIN) / Math.log(ELO_MAX / ELO_MIN);
}

/** Continuous 0–1 conversion quality from bot Elo (100 → 0, 3200 → 1). */
export function endgameConversionBlend(elo: number): number {
  return eloProgress(elo) ** 0.85;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export const ENDGAME_CONVERSION_MAX_NON_KING_PIECES = 4;
export const ENDGAME_CONVERSION_MIN_MATERIAL_LEAD = 5;

function countNonKingPieces(chess: Chess): number {
  let count = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type !== 'k') {
        count += 1;
      }
    }
  }
  return count;
}

function sideHasMajorPiece(chess: Chess, color: Color): boolean {
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.color === color && (piece.type === 'q' || piece.type === 'r')) {
        return true;
      }
    }
  }
  return false;
}

function sideHasQueen(chess: Chess, color: Color): boolean {
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.color === color && piece.type === 'q') {
        return true;
      }
    }
  }
  return false;
}

function countRooks(chess: Chess, color: Color): number {
  let count = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.color === color && piece.type === 'r') {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Trivial forced-win material (K+Q vs K, K+R vs K, K+2R vs K, etc.).
 * Excludes K+Q vs K+R and any endgame where the opponent still has major pieces.
 */
export function isTrivialWinningEndgame(fen: string, botColor: Color): boolean {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver() || chess.isInsufficientMaterial()) {
      return false;
    }

    if (chess.turn() !== botColor) {
      return false;
    }

    if (countNonKingPieces(chess) > ENDGAME_CONVERSION_MAX_NON_KING_PIECES) {
      return false;
    }

    const opponent: Color = botColor === 'w' ? 'b' : 'w';
    const materialLead = countMaterial(chess, botColor) - countMaterial(chess, opponent);
    if (materialLead < ENDGAME_CONVERSION_MIN_MATERIAL_LEAD) {
      return false;
    }

    if (sideHasMajorPiece(chess, opponent)) {
      return false;
    }

    const botRooks = countRooks(chess, botColor);
    const botHasQueen = sideHasQueen(chess, botColor);
    if (!botHasQueen && botRooks === 0) {
      return false;
    }

    return botHasQueen || botRooks >= 1;
  } catch {
    return false;
  }
}

export type EndgameConversionResult = {
  active: boolean;
  effectiveBlend: number;
  calibration: EloCalibration;
  strengthOverrides?: BotStrengthOverrides;
};

/** Apply continuous Elo-scaled conversion knobs when in a trivial winning endgame. */
export function getEndgameConversionCalibration(
  fen: string,
  botColor: Color,
  base: EloCalibration,
): EndgameConversionResult {
  if (base.useMaterialOnlyEval || !isTrivialWinningEndgame(fen, botColor)) {
    return {
      active: false,
      effectiveBlend: 0,
      calibration: base,
    };
  }

  const effectiveBlend = endgameConversionBlend(base.elo);
  const normalUci = stockfishUciEloFromBotElo(base.elo);

  const calibration: EloCalibration = {
    ...base,
    bestMoveProbability: lerp(base.bestMoveProbability, 1, effectiveBlend),
    blunderSeverity: lerp(base.blunderSeverity, 1, effectiveBlend),
    evalNoise: Math.round(lerp(base.evalNoise, 0, effectiveBlend)),
    stockfishSearchDepth: Math.round(
      lerp(base.stockfishSearchDepth, ENDGAME_CONVERSION_MAX_SEARCH_DEPTH, effectiveBlend),
    ),
    stockfishSkillLevel: Math.round(lerp(base.stockfishSkillLevel, 20, effectiveBlend)),
  };

  if (base.elo >= ELO_MAX) {
    return {
      active: true,
      effectiveBlend,
      calibration,
    };
  }

  const strengthOverrides: BotStrengthOverrides = {
    uciElo: Math.round(lerp(normalUci, STOCKFISH_UCI_ELO_MAX, effectiveBlend)),
  };

  if (base.elo < STOCKFISH_UCI_ELO_MIN) {
    strengthOverrides.skillLevel = calibration.stockfishSkillLevel;
  }

  return {
    active: true,
    effectiveBlend,
    calibration,
    strengthOverrides,
  };
}
