import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatEvalLabel } from './evalBarLabel';
import { NEUTRAL_POSITION_EVAL } from './liveEval';

describe('formatEvalLabel', () => {
  it('shows neutral as 0.0', () => {
    assert.equal(formatEvalLabel(NEUTRAL_POSITION_EVAL), '0.0');
  });

  it('shows positive pawn eval when white is better', () => {
    assert.equal(
      formatEvalLabel({ isNeutral: false, centipawnsWhite: 180, mateInWhite: null }),
      '+1.8',
    );
  });

  it('shows positive pawn eval when black is better', () => {
    assert.equal(
      formatEvalLabel({ isNeutral: false, centipawnsWhite: -240, mateInWhite: null }),
      '+2.4',
    );
  });

  it('shows mate distance without sign for either side', () => {
    assert.equal(
      formatEvalLabel({ isNeutral: false, centipawnsWhite: 0, mateInWhite: 3 }),
      'M3',
    );
    assert.equal(
      formatEvalLabel({ isNeutral: false, centipawnsWhite: 0, mateInWhite: -5 }),
      'M5',
    );
  });
});
