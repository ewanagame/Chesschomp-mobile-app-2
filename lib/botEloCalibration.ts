export const ELO_MIN = 100;
export const ELO_MAX = 3200;
export const MATERIAL_EVAL_ELO_THRESHOLD = 900;

export type EloCalibration = {
  elo: number;
  /** Material-search ply depth (used below MATERIAL_EVAL_ELO_THRESHOLD). */
  searchDepth: number;
  /** Probability of playing the top-ranked move (0–1). */
  bestMoveProbability: number;
  /**
   * When not playing best: 0 = severe blunders / random bad moves,
   * 1 = minor inaccuracies only (2nd–3rd best).
   */
  blunderSeverity: number;
  /** Random centipawn noise applied when ranking candidate moves. */
  evalNoise: number;
  /** Use lightweight material eval instead of Stockfish. */
  useMaterialOnlyEval: boolean;
  stockfishSkillLevel: number;
  stockfishMovetimeMs: number;
  stockfishSearchDepth: number;
};

const CALIBRATION_SAMPLE_ELOS = [100, 300, 600, 1000, 1500, 2000, 2800] as const;

function clampElo(elo: number): number {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, elo));
}

/** Log-scaled 0–1 progress from beginner to max tier. */
function eloProgress(elo: number): number {
  const clamped = clampElo(elo);
  return Math.log(clamped / ELO_MIN) / Math.log(ELO_MAX / ELO_MIN);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function getEloCalibration(elo: number): EloCalibration {
  const numericElo = Number(elo);
  const clamped = clampElo(Number.isFinite(numericElo) ? numericElo : ELO_MIN);
  const progress = eloProgress(clamped);

  const searchDepth = Math.max(1, Math.min(4, Math.round(1 + progress * 3)));

  const bestMoveProbability = round(
    0.45 + 0.54 * progress ** 0.85,
  );

  const blunderSeverity = round(progress ** 0.7);

  const evalNoise = Math.round(220 * (1 - progress ** 1.1));

  const useMaterialOnlyEval = clamped < MATERIAL_EVAL_ELO_THRESHOLD;

  const stockfishSkillLevel = Math.round(20 * progress ** 1.15);

  const stockfishMovetimeMs = Math.round(250 + 750 * progress ** 0.9);

  const stockfishSearchDepth = Math.round(6 + 12 * progress ** 0.95);

  return {
    elo: clamped,
    searchDepth,
    bestMoveProbability,
    blunderSeverity,
    evalNoise,
    useMaterialOnlyEval,
    stockfishSkillLevel,
    stockfishMovetimeMs,
    stockfishSearchDepth,
  };
}

/** True when bot move selection must use the Stockfish UCI bridge. */
export function botMoveUsesStockfish(bot: Pick<{ elo: number; behavior: string }, 'elo' | 'behavior'>): boolean {
  if (bot.behavior === 'losing') {
    return true;
  }
  if (bot.behavior === 'tier600') {
    return false;
  }
  return !getEloCalibration(bot.elo).useMaterialOnlyEval;
}

export function logEloCalibrationSamples(): void {
  console.log('[Bot ELO Calibration] Sample curve values:');
  for (const elo of CALIBRATION_SAMPLE_ELOS) {
    console.log(`  elo ${elo}:`, getEloCalibration(elo));
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  logEloCalibrationSamples();
}
