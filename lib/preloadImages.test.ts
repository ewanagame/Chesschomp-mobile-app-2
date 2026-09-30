import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { imageModuleIds } from './imageModuleIds';

describe('imageModuleIds', () => {
  it('keeps Metro require ids and drops uri sources', () => {
    assert.deepEqual(imageModuleIds([12, { uri: 'https://example.com/bot.png' }, 7]), [12, 7]);
  });

  it('returns empty when nothing is a bundled module', () => {
    assert.deepEqual(imageModuleIds([{ uri: 'file://bot.png' }]), []);
  });
});
