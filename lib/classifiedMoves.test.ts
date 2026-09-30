import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { alignClassifiedMovesToSans, parseClassifiedMoves } from './classifiedMoves';

function record(san: string, classification: ClassifiedMoveRecord['classification']): ClassifiedMoveRecord {
  return {
    move: 'e2e4',
    san,
    color: 'w',
    classification,
    evalBefore: 20,
    evalAfter: 25,
    wasBestMove: classification === 'Best',
    fenBefore: 'start',
    fenAfter: 'after',
  };
}

describe('alignClassifiedMovesToSans', () => {
  it('keeps the full matching line when viewing an earlier ply', () => {
    const records = [record('e4', 'Best'), record('e5', 'Excellent'), record('Nf3', 'Good')];
    assert.deepEqual(alignClassifiedMovesToSans(records, ['e4', 'e5', 'Nf3']), records);
  });

  it('stops at the first SAN mismatch so a branch drops later types', () => {
    const records = [record('e4', 'Best'), record('e5', 'Excellent'), record('Nf3', 'Good')];
    assert.deepEqual(alignClassifiedMovesToSans(records, ['e4', 'c5']), [records[0]]);
  });

  it('returns an empty list when the first move no longer matches', () => {
    assert.deepEqual(alignClassifiedMovesToSans([record('e4', 'Best')], ['d4']), []);
  });
});

describe('parseClassifiedMoves', () => {
  it('keeps a valid prefix and ignores a broken tail', () => {
    const parsed = parseClassifiedMoves([record('e4', 'Blunder'), { san: 'nope' }]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.classification, 'Blunder');
  });
});
