export type LivePositionEval = {
  /** True for the starting position before any move has been analyzed for display. */
  isNeutral: boolean;
  /** Centipawns from White's perspective (positive = White better). */
  centipawnsWhite: number;
  /** Mate distance from White's perspective (+ = White mates, − = Black mates). */
  mateInWhite: number | null;
};

export const NEUTRAL_POSITION_EVAL: LivePositionEval = {
  isNeutral: true,
  centipawnsWhite: 0,
  mateInWhite: null,
};
