import { DEFAULT_POSITION } from 'chess.js';

import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';

/** Position shown on the board when reviewing ply N (after move N was played). */
export function reviewDisplayFenForPly(
  plyIndex: number,
  fens: readonly string[],
  record?: ClassifiedMoveRecord,
): string {
  if (plyIndex < 0) {
    return DEFAULT_POSITION;
  }
  return record?.fenAfter ?? fens[plyIndex] ?? DEFAULT_POSITION;
}
