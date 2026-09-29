import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PLAYER_NAME,
  limitPlayerNameWords,
  normalizePlayerName,
} from './playerName';

describe('normalizePlayerName', () => {
  it('defaults empty input to You', () => {
    assert.equal(normalizePlayerName(''), DEFAULT_PLAYER_NAME);
    assert.equal(normalizePlayerName('   '), DEFAULT_PLAYER_NAME);
  });

  it('collapses whitespace and trims', () => {
    assert.equal(normalizePlayerName('  Big   Chomp  '), 'Big Chomp');
  });

  it('limits to fifteen words', () => {
    const sixteenWords = Array.from({ length: 16 }, (_, index) => `w${index + 1}`).join(' ');
    assert.equal(
      normalizePlayerName(sixteenWords),
      Array.from({ length: 15 }, (_, index) => `w${index + 1}`).join(' '),
    );
  });
});

describe('limitPlayerNameWords', () => {
  it('allows up to fifteen words while typing', () => {
    const fifteenWords = Array.from({ length: 15 }, (_, index) => `w${index + 1}`).join(' ');
    assert.equal(limitPlayerNameWords(fifteenWords), fifteenWords);
  });

  it('blocks a sixteenth word', () => {
    const sixteenWords = Array.from({ length: 16 }, (_, index) => `w${index + 1}`).join(' ');
    const fifteenWords = Array.from({ length: 15 }, (_, index) => `w${index + 1}`).join(' ');
    assert.equal(limitPlayerNameWords(sixteenWords), fifteenWords);
  });
});
