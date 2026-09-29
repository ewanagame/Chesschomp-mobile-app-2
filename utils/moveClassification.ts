export type MoveClassification =
  | 'Brilliant'
  | 'Great'
  | 'Miss'
  | 'MissedWin'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Forced'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder';

/** Winning advantage on the best line (mover cp) — ~+5.0 pawn equivalent. */
export const MISSED_WIN_CP_THRESHOLD = 500;
/** Minimum gap between best-line and played-line eval to flag a missed win. */
export const MISSED_WIN_CP_DROP_THRESHOLD = 150;
/** Minimum win% gap between best and played lines for a missed win. */
export const MISSED_WIN_WIN_PERCENT_DROP = 10;

/**
 * Chess.com Classification V2 — expected points lost per move.
 * @see https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc
 *
 * We approximate expected points as win probability (0–1) from the Lichess cp→win% formula,
 * since the full rating-adjusted Chess.com model is not public.
 */
export const CHESS_COM_EXPECTED_POINTS = {
  best: 0,
  excellent: 0.02,
  good: 0.05,
  inaccuracy: 0.1,
  mistake: 0.2,
  blunder: 1,
} as const;

export type ClassifyMoveInput = {
  /** Stockfish eval of the position before the move, from the mover's perspective (centipawns). */
  evalBeforeMoveCentipawns: number;
  /** Stockfish eval of the position after the move, from the mover's perspective (centipawns). */
  evalAfterMoveCentipawns: number;
  /** Whether the played move matched Stockfish's top recommendation. */
  wasBestMove: boolean;
  /** Whether the move is still within known opening theory. */
  isBookMove: boolean;
  /** Whether the move intentionally gives up material (see lib/materialEval.ts). */
  isMaterialSacrifice?: boolean;
  /** Win% gap between Stockfish's #1 and #2 lines before the move (mover perspective). */
  bestSecondWinPercentGap?: number;
  /** Engine sees forced mate for the mover in the pre-move position. */
  missedForcedMate?: boolean;
  /** Engine's best move wins clear material that the played move did not take. */
  missedMaterialOpportunity?: boolean;
  /** Only one legal move existed — skip normal quality scoring. */
  isForcedMove?: boolean;
  /** The played move allows the opponent an immediate forced mate. */
  allowsOpponentMate?: boolean;
  /** The played move delivered checkmate (SAN includes '#'). */
  deliveredCheckmate?: boolean;
  /** Pawn promoted to a piece other than a queen. */
  isUnderpromotion?: boolean;
};

export const GREAT_WIN_PERCENT_GAP_THRESHOLD = 10;

/** Sacrifice must leave the mover at least this eval (cp) to count as Brilliant. */
export const BRILLIANT_MIN_EVAL_CP = 0;

export function meetsBrilliantEvalThreshold(evalAfterMoveCentipawns: number): boolean {
  return evalAfterMoveCentipawns >= BRILLIANT_MIN_EVAL_CP;
}

/** Lichess-style centipawn → win probability (0–100, mover's perspective). */
export function centipawnsToWinPercent(centipawns: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}

/** Approximate Chess.com expected points (0–1) from mover-perspective centipawns. */
export function expectedPointsFromCentipawns(centipawns: number): number {
  return centipawnsToWinPercent(centipawns) / 100;
}

/** Expected points lost by the played move (before → after, mover perspective). */
export function expectedPointsLost(
  evalBeforeMoveCentipawns: number,
  evalAfterMoveCentipawns: number,
): number {
  const before = expectedPointsFromCentipawns(evalBeforeMoveCentipawns);
  const after = expectedPointsFromCentipawns(evalAfterMoveCentipawns);
  return Math.max(0, before - after);
}

/**
 * Step 2 — chess.com-style quality bucket from expected points lost on the played line.
 * Never returns Best — that label requires wasBestMove in classifyMove().
 */
export function classifyMoveQuality(expectedPointsLoss: number): MoveClassification {
  if (expectedPointsLoss <= CHESS_COM_EXPECTED_POINTS.excellent) {
    return 'Excellent';
  }
  if (expectedPointsLoss <= CHESS_COM_EXPECTED_POINTS.good) {
    return 'Good';
  }
  if (expectedPointsLoss <= CHESS_COM_EXPECTED_POINTS.inaccuracy) {
    return 'Inaccuracy';
  }
  if (expectedPointsLoss <= CHESS_COM_EXPECTED_POINTS.mistake) {
    return 'Mistake';
  }
  return 'Blunder';
}

/**
 * Primary move quality label (Step 2 + special cases).
 * Does NOT return MissedWin — use {@link detectMissedWin} for that tag separately.
 *
 * Priority: Forced > Brilliant > Great > Book > Best > opponent-mate Blunder > Miss > EP tiers.
 */
export function classifyMove(input: ClassifyMoveInput): MoveClassification {
  const {
    evalBeforeMoveCentipawns,
    evalAfterMoveCentipawns,
    wasBestMove,
    isBookMove,
    isMaterialSacrifice = false,
    bestSecondWinPercentGap = 0,
    missedForcedMate = false,
    missedMaterialOpportunity = false,
    isForcedMove = false,
    allowsOpponentMate = false,
    deliveredCheckmate = false,
    isUnderpromotion = false,
  } = input;

  if (isForcedMove) {
    return 'Forced';
  }

  if (deliveredCheckmate) {
    return 'Best';
  }

  const pointsLost = expectedPointsLost(evalBeforeMoveCentipawns, evalAfterMoveCentipawns);
  const brilliantSacrifice = isMaterialSacrifice || isUnderpromotion;

  if (wasBestMove && brilliantSacrifice && meetsBrilliantEvalThreshold(evalAfterMoveCentipawns)) {
    return 'Brilliant';
  }

  if (wasBestMove && bestSecondWinPercentGap >= GREAT_WIN_PERCENT_GAP_THRESHOLD) {
    return 'Great';
  }

  if (isBookMove && pointsLost <= CHESS_COM_EXPECTED_POINTS.good) {
    return 'Book';
  }

  if (wasBestMove) {
    return 'Best';
  }

  if (allowsOpponentMate) {
    return 'Blunder';
  }

  if (!wasBestMove && (missedForcedMate || missedMaterialOpportunity)) {
    return 'Miss';
  }

  return classifyMoveQuality(pointsLost);
}

/** Best quality tier and missed-win tag are mutually exclusive by definition. */
export function assertClassificationInvariants(
  classification: MoveClassification,
  wasBestMove: boolean,
  missedWin: boolean,
  deliveredCheckmate = false,
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  if (wasBestMove && missedWin) {
    console.error(
      '[Move Classification] invariant violated: wasBestMove and missedWin both true',
    );
  }
  if (classification === 'Best' && missedWin) {
    console.error(
      '[Move Classification] invariant violated: Best classification with missedWin tag',
    );
  }
  if (classification === 'Best' && !wasBestMove && !deliveredCheckmate) {
    console.error(
      '[Move Classification] invariant violated: Best classification without wasBestMove',
    );
  }
}

/** Temporary startup samples — remove once wired into the board. */
export function logMoveClassificationSamples(): void {
  const samples: Array<{ label: string; input: ClassifyMoveInput; missedWin?: boolean }> = [
    {
      label: 'Missed win while still winning (quality ≠ missed win)',
      input: {
        evalBeforeMoveCentipawns: 800,
        evalAfterMoveCentipawns: 350,
        wasBestMove: false,
        isBookMove: false,
      },
      missedWin: true,
    },
    {
      label: 'Blunder without missed win (equal → lost)',
      input: {
        evalBeforeMoveCentipawns: 50,
        evalAfterMoveCentipawns: -400,
        wasBestMove: false,
        isBookMove: false,
      },
      missedWin: false,
    },
    {
      label: 'Blunder + missed win (had mate, hung own king)',
      input: {
        evalBeforeMoveCentipawns: 900,
        evalAfterMoveCentipawns: -99_000,
        wasBestMove: false,
        isBookMove: false,
        allowsOpponentMate: true,
      },
      missedWin: true,
    },
  ];

  console.log('[moveClassification] sample classifications:');
  for (const { label, input, missedWin } of samples) {
    const pointsLost = expectedPointsLost(
      input.evalBeforeMoveCentipawns,
      input.evalAfterMoveCentipawns,
    );
    const result = classifyMove(input);
    const tag = missedWin ? `${result} + Missed Win` : result;
    console.log(`  ${label}: ${tag} (EP loss ${pointsLost.toFixed(3)})`);
  }
}
