import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeClassifiedMove(value: unknown): ClassifiedMoveRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<ClassifiedMoveRecord>;
  if (
    typeof record.move !== 'string' ||
    typeof record.san !== 'string' ||
    (record.color !== 'w' && record.color !== 'b') ||
    typeof record.classification !== 'string' ||
    typeof record.wasBestMove !== 'boolean' ||
    typeof record.fenBefore !== 'string' ||
    typeof record.fenAfter !== 'string' ||
    (record.bestMoveUci != null && typeof record.bestMoveUci !== 'string')
  ) {
    return null;
  }

  return {
    ...record,
    move: record.move,
    san: record.san,
    color: record.color,
    classification: record.classification,
    evalBefore: finiteNumber(record.evalBefore),
    evalAfter: finiteNumber(record.evalAfter),
    wasBestMove: record.wasBestMove,
    fenBefore: record.fenBefore,
    fenAfter: record.fenAfter,
    bestMoveUci: record.bestMoveUci,
    bestMoveEval:
      record.bestMoveEval == null ? record.bestMoveEval : finiteNumber(record.bestMoveEval),
    evalDelta: record.evalDelta == null ? record.evalDelta : finiteNumber(record.evalDelta),
    mateInWhiteAfter:
      record.mateInWhiteAfter == null
        ? record.mateInWhiteAfter
        : finiteNumber(record.mateInWhiteAfter),
  };
}

/** Keep the recorded prefix that still matches the current game line. */
export function alignClassifiedMovesToSans(
  records: readonly ClassifiedMoveRecord[],
  sans: readonly string[],
): ClassifiedMoveRecord[] {
  const aligned: ClassifiedMoveRecord[] = [];
  for (let index = 0; index < sans.length; index += 1) {
    const record = records[index];
    if (!record || record.san !== sans[index]) {
      break;
    }
    aligned.push(record);
  }
  return aligned;
}

export function parseClassifiedMoves(value: unknown): ClassifiedMoveRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: ClassifiedMoveRecord[] = [];
  for (const item of value) {
    const record = normalizeClassifiedMove(item);
    if (!record) {
      break;
    }
    normalized.push(record);
  }
  return normalized;
}
