/** Matches {@link scoreToCentipawns} mate encoding in stockfishAnalysis. */
export const MATE_PSEUDO_CP_BASE = 100_000;
export const MATE_PSEUDO_CP_STEP = 1_000;
export const MATE_PSEUDO_CP_THRESHOLD = 90_000;

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

export type ClassifiedMoveEvalSource = {
  color: 'w' | 'b';
  evalAfter: number;
  mateInWhiteAfter?: number | null;
};

export type ClassifiedMoveEvalBeforeSource = {
  color: 'w' | 'b';
  evalBefore: number;
};

/** Decode Stockfish pseudo-centipawn mate scores back into mate distance. */
export function mateInWhiteFromPseudoCentipawns(centipawnsWhite: number): number | null {
  const magnitude = Math.abs(centipawnsWhite);
  if (magnitude < MATE_PSEUDO_CP_THRESHOLD) {
    return null;
  }

  const mateDistance = Math.round((MATE_PSEUDO_CP_BASE - magnitude) / MATE_PSEUDO_CP_STEP);
  if (mateDistance < 1) {
    return null;
  }

  return centipawnsWhite > 0 ? mateDistance : -mateDistance;
}

function liveEvalFromMoverCentipawns(
  centipawnsForMover: number,
  mover: 'w' | 'b',
): LivePositionEval {
  const centipawnsWhite = mover === 'w' ? centipawnsForMover : -centipawnsForMover;
  const mateInWhite = mateInWhiteFromPseudoCentipawns(centipawnsWhite);

  if (mateInWhite != null) {
    return {
      isNeutral: false,
      centipawnsWhite: 0,
      mateInWhite,
    };
  }

  return {
    isNeutral: false,
    centipawnsWhite,
    mateInWhite: null,
  };
}

/** Build eval-bar state from the position before a classified move. */
export function liveEvalFromEvalBefore(record: ClassifiedMoveEvalBeforeSource): LivePositionEval {
  return liveEvalFromMoverCentipawns(record.evalBefore, record.color);
}

/** Build eval-bar state from a stored move classification record. */
export function liveEvalFromClassifiedRecord(record: ClassifiedMoveEvalSource): LivePositionEval {
  const centipawnsWhite = record.color === 'w' ? record.evalAfter : -record.evalAfter;
  const mateInWhite =
    record.mateInWhiteAfter ??
    mateInWhiteFromPseudoCentipawns(centipawnsWhite);

  if (mateInWhite != null) {
    return {
      isNeutral: false,
      centipawnsWhite: 0,
      mateInWhite,
    };
  }

  return liveEvalFromMoverCentipawns(record.evalAfter, record.color);
}
