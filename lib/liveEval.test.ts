import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  liveEvalFromClassifiedRecord,
  liveEvalFromEvalBefore,
  mateInWhiteFromPseudoCentipawns,
} from './liveEval';

describe('mateInWhiteFromPseudoCentipawns', () => {
  it('decodes mate-in-1 for White', () => {
    assert.equal(mateInWhiteFromPseudoCentipawns(99_000), 1);
    assert.equal(mateInWhiteFromPseudoCentipawns(-99_000), -1);
  });

  it('decodes mate-in-2 for White', () => {
    assert.equal(mateInWhiteFromPseudoCentipawns(98_000), 2);
    assert.equal(mateInWhiteFromPseudoCentipawns(-98_000), -2);
  });

  it('returns null for normal centipawn scores', () => {
    assert.equal(mateInWhiteFromPseudoCentipawns(520), null);
    assert.equal(mateInWhiteFromPseudoCentipawns(-180), null);
  });
});

describe('liveEvalFromClassifiedRecord', () => {
  it('uses stored mate metadata when present', () => {
    assert.deepEqual(
      liveEvalFromClassifiedRecord({
        color: 'w',
        evalAfter: 99_000,
        mateInWhiteAfter: 1,
      }),
      {
        isNeutral: false,
        centipawnsWhite: 0,
        mateInWhite: 1,
      },
    );
  });

  it('decodes legacy pseudo-mate centipawns for older records', () => {
    assert.deepEqual(
      liveEvalFromClassifiedRecord({
        color: 'w',
        evalAfter: 98_000,
      }),
      {
        isNeutral: false,
        centipawnsWhite: 0,
        mateInWhite: 2,
      },
    );
  });

  it('keeps regular centipawn evals unchanged', () => {
    assert.deepEqual(
      liveEvalFromClassifiedRecord({
        color: 'b',
        evalAfter: 150,
      }),
      {
        isNeutral: false,
        centipawnsWhite: -150,
        mateInWhite: null,
      },
    );
  });
});

describe('liveEvalFromEvalBefore', () => {
  it('converts mover-perspective evalBefore to white-perspective centipawns', () => {
    assert.deepEqual(
      liveEvalFromEvalBefore({
        color: 'b',
        evalBefore: 120,
      }),
      {
        isNeutral: false,
        centipawnsWhite: -120,
        mateInWhite: null,
      },
    );
  });
});
