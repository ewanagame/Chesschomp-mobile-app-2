import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseActiveGameSnapshot } from './activeGameSnapshot';
import { appendMove, createGameSession } from './gameHistory';

const AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function validSnapshot() {
  const session = appendMove(createGameSession('Finn the Clownfish'), 'e4', AFTER_E4);
  return {
    mode: 'bot' as const,
    botId: 'finn',
    session,
    boardOrientation: 'white' as const,
    playerColor: 'w' as const,
    passAndPlayEnabled: false,
    savedAt: 1_700_000_000_000,
  };
}

describe('parseActiveGameSnapshot', () => {
  it('accepts a valid bot-game snapshot', () => {
    const parsed = parseActiveGameSnapshot(validSnapshot());
    assert.deepEqual(parsed, validSnapshot());
  });

  it('accepts a valid free-board snapshot without botId', () => {
    const snapshot = {
      ...validSnapshot(),
      mode: 'free' as const,
      botId: undefined,
    };
    const parsed = parseActiveGameSnapshot(snapshot);
    assert.equal(parsed?.mode, 'free');
    assert.equal(parsed?.botId, undefined);
  });

  it('preserves a finished checkmate snapshot', () => {
    const snapshot = {
      ...validSnapshot(),
      finished: true as const,
    };
    const parsed = parseActiveGameSnapshot(snapshot);
    assert.equal(parsed?.finished, true);
  });

  it('rejects snapshots with no moves', () => {
    const snapshot = {
      ...validSnapshot(),
      session: createGameSession('Opponent'),
    };
    assert.equal(parseActiveGameSnapshot(snapshot), null);
  });

  it('rejects bot snapshots without botId', () => {
    const snapshot = {
      ...validSnapshot(),
      botId: undefined,
    };
    assert.equal(parseActiveGameSnapshot(snapshot), null);
  });

  it('rejects malformed payloads', () => {
    assert.equal(parseActiveGameSnapshot(null), null);
    assert.equal(parseActiveGameSnapshot({ mode: 'free' }), null);
  });
});
