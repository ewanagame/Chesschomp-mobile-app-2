import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { swordRotationDegrees } from './checkmateOverlayMath';

describe('swordRotationDegrees', () => {
  it('returns 0 when the target king is directly below the mating square', () => {
    assert.equal(swordRotationDegrees(100, 100, 100, 200), 0);
  });

  it('returns -90 when the target king is directly to the right', () => {
    assert.equal(swordRotationDegrees(100, 100, 200, 100), -90);
  });

  it('returns 90 when the target king is directly to the left', () => {
    assert.equal(swordRotationDegrees(200, 100, 100, 100), 90);
  });
});
