import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PLAY_TOGETHER_DESCRIPTION,
  PLAY_TOGETHER_TAGLINE,
  PLAY_TOGETHER_TITLE,
} from './playTogetherContent';

describe('playTogether copy', () => {
  it('exports simple feature text', () => {
    assert.match(PLAY_TOGETHER_TITLE, /Play Together/i);
    assert.match(PLAY_TOGETHER_TAGLINE, /one phone/i);
    assert.match(PLAY_TOGETHER_DESCRIPTION, /Free Board/i);
    assert.match(PLAY_TOGETHER_DESCRIPTION, /flips on its own/i);
  });
});
