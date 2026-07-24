export type MoveClassification =
  | 'Brilliant'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder';

export type ClassifyMoveInput = {
  /** Stockfish eval of the position before the move, from the mover's perspective (centipawns). */
  evalBeforeMoveCentipawns: number;
  /** Stockfish eval of the position after the move, from the mover's perspective (centipawns). */
  evalAfterMoveCentipawns: number;
  /** Whether the played move matched Stockfish's top recommendation. */
  wasBestMove: boolean;
  /** Whether the move is still within known opening theory. */
  isBookMove: boolean;
  /**
   * Placeholder for future sacrifice detection.
   * When true and wasBestMove, classifies as Brilliant.
   */
  isSacrifice?: boolean;
};

/** Lichess-style centipawn → win probability (0–100, mover's perspective). */
export function centipawnsToWinPercent(centipawns: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}

/**
 * Classify a single move from eval deltas and engine/book metadata.
 * Pure function — no I/O, no engine or board dependencies.
 */
export function classifyMove(input: ClassifyMoveInput): MoveClassification {
  const {
    evalBeforeMoveCentipawns,
    evalAfterMoveCentipawns,
    wasBestMove,
    isBookMove,
    isSacrifice = false,
  } = input;

  if (isBookMove) {
    return 'Book';
  }

  const winPercentBefore = centipawnsToWinPercent(evalBeforeMoveCentipawns);
  const winPercentAfter = centipawnsToWinPercent(evalAfterMoveCentipawns);
  const winPercentDrop = winPercentBefore - winPercentAfter;

  if (wasBestMove && isSacrifice) {
    return 'Brilliant';
  }

  if (wasBestMove && winPercentDrop <= 0) {
    return 'Best';
  }

  if (winPercentDrop <= 2) {
    return 'Excellent';
  }
  if (winPercentDrop <= 5) {
    return 'Good';
  }
  if (winPercentDrop <= 10) {
    return 'Inaccuracy';
  }
  if (winPercentDrop <= 20) {
    return 'Mistake';
  }
  return 'Blunder';
}

/** Temporary startup samples — remove once wired into the board. */
export function logMoveClassificationSamples(): void {
  const samples: Array<{ label: string; input: ClassifyMoveInput }> = [
    {
      label: 'Opening theory',
      input: {
        evalBeforeMoveCentipawns: 25,
        evalAfterMoveCentipawns: 25,
        wasBestMove: true,
        isBookMove: true,
      },
    },
    {
      label: 'Engine best, no win% loss',
      input: {
        evalBeforeMoveCentipawns: 120,
        evalAfterMoveCentipawns: 130,
        wasBestMove: true,
        isBookMove: false,
      },
    },
    {
      label: 'Best move with sacrifice (Brilliant placeholder)',
      input: {
        evalBeforeMoveCentipawns: 80,
        evalAfterMoveCentipawns: 60,
        wasBestMove: true,
        isBookMove: false,
        isSacrifice: true,
      },
    },
    {
      label: 'Tiny win% drop (~1%)',
      input: {
        evalBeforeMoveCentipawns: 150,
        evalAfterMoveCentipawns: 130,
        wasBestMove: false,
        isBookMove: false,
      },
    },
    {
      label: 'Moderate win% drop (~3%, Good)',
      input: {
        evalBeforeMoveCentipawns: 100,
        evalAfterMoveCentipawns: 70,
        wasBestMove: false,
        isBookMove: false,
      },
    },
    {
      label: 'Clear inaccuracy (~7%)',
      input: {
        evalBeforeMoveCentipawns: 160,
        evalAfterMoveCentipawns: 70,
        wasBestMove: false,
        isBookMove: false,
      },
    },
    {
      label: 'Mistake (~15%)',
      input: {
        evalBeforeMoveCentipawns: 200,
        evalAfterMoveCentipawns: 30,
        wasBestMove: false,
        isBookMove: false,
      },
    },
    {
      label: 'Blunder (~30%+)',
      input: {
        evalBeforeMoveCentipawns: 300,
        evalAfterMoveCentipawns: -400,
        wasBestMove: false,
        isBookMove: false,
      },
    },
  ];

  console.log('[moveClassification] sample classifications:');
  for (const { label, input } of samples) {
    const winBefore = centipawnsToWinPercent(input.evalBeforeMoveCentipawns);
    const winAfter = centipawnsToWinPercent(input.evalAfterMoveCentipawns);
    const drop = winBefore - winAfter;
    const result = classifyMove(input);
    console.log(
      `  ${label}: ${result} (win% ${winBefore.toFixed(1)} → ${winAfter.toFixed(1)}, drop ${drop.toFixed(1)}%)`,
    );
  }
}
