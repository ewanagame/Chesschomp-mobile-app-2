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
    const snapshot = validSnapshot();
    const parsed = parseActiveGameSnapshot(snapshot);
    assert.deepEqual(parsed, snapshot);
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

  it('keeps recorded move types that match the saved line', () => {
    const snapshot = {
      ...validSnapshot(),
      classifiedMoves: [
        {
          move: 'e2e4',
          san: 'e4',
          color: 'w' as const,
          classification: 'Best' as const,
          evalBefore: 20,
          evalAfter: 30,
          wasBestMove: true,
          fenBefore: 'start',
          fenAfter: AFTER_E4,
        },
      ],
    };
    const parsed = parseActiveGameSnapshot(snapshot);
    assert.equal(parsed?.classifiedMoves?.[0]?.classification, 'Best');
  });

  it('drops move types that no longer match the saved line', () => {
    const snapshot = {
      ...validSnapshot(),
      classifiedMoves: [
        {
          move: 'd2d4',
          san: 'd4',
          color: 'w' as const,
          classification: 'Good' as const,
          evalBefore: 10,
          evalAfter: 12,
          wasBestMove: false,
          fenBefore: 'start',
          fenAfter: AFTER_E4,
        },
      ],
    };
    const parsed = parseActiveGameSnapshot(snapshot);
    assert.equal(parsed?.classifiedMoves, undefined);
  });
});
