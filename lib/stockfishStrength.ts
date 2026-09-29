import { ELO_MAX, type EloCalibration } from './botEloCalibration';

/** Stockfish UCI_Elo option range (see vendor Skill struct). */
export const STOCKFISH_UCI_ELO_MIN = 1320;
export const STOCKFISH_UCI_ELO_MAX = 3190;

export type BotStrengthOverrides = {
  uciElo?: number;
  skillLevel?: number;
};

export function stockfishUciEloFromBotElo(botElo: number): number {
  return Math.max(
    STOCKFISH_UCI_ELO_MIN,
    Math.min(STOCKFISH_UCI_ELO_MAX, Math.round(botElo)),
  );
}

/**
 * Apply calibrated bot strength before a bot-owned search.
 *
 * - Below 1320 advertised Elo (e.g. Milo 1000): UCI_Elo floor + Skill Level softener.
 * - 1320–3190: UCI_LimitStrength + UCI_Elo only (Stockfish ignores Skill Level).
 * - ELO_MAX (3200): full engine — LimitStrength off, Skill Level 20.
 */
export function applyBotStrengthOptions(
  sendCommand: (command: string) => void,
  calibration: EloCalibration,
  overrides?: BotStrengthOverrides,
): void {
  if (calibration.elo >= ELO_MAX) {
    sendCommand('setoption name UCI_LimitStrength value false');
    sendCommand('setoption name Skill Level value 20');
    return;
  }

  const uciElo = overrides?.uciElo ?? stockfishUciEloFromBotElo(calibration.elo);
  sendCommand('setoption name UCI_LimitStrength value true');
  sendCommand(`setoption name UCI_Elo value ${uciElo}`);

  if (calibration.elo < STOCKFISH_UCI_ELO_MIN) {
    const skillLevel = overrides?.skillLevel ?? calibration.stockfishSkillLevel;
    sendCommand(`setoption name Skill Level value ${skillLevel}`);
  }
}

/** Restore full-strength defaults for move classification / live eval. */
export function restoreAnalysisStrengthOptions(sendCommand: (command: string) => void): void {
  sendCommand('setoption name UCI_LimitStrength value false');
  sendCommand('setoption name Skill Level value 20');
}

export function botMoveKey(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`.toLowerCase();
}
