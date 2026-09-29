import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  boardOrientationForColor,
  passAndPlaySideLabel,
  passAndPlayTurnLabel,
} from './passAndPlay';

describe('passAndPlay helpers', () => {
  it('maps each side to the board orientation that puts them at the bottom', () => {
    assert.equal(boardOrientationForColor('w'), 'white');
    assert.equal(boardOrientationForColor('b'), 'black');
  });

  it('labels sides and turn text for the pass-and-play banner', () => {
    assert.equal(passAndPlaySideLabel('w'), 'White');
    assert.equal(passAndPlaySideLabel('b'), 'Black');
    assert.equal(passAndPlayTurnLabel('w'), 'White to move');
    assert.equal(passAndPlayTurnLabel('b'), 'Black to move');
  });
});
