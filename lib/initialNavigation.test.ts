import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appendMove, createGameSession } from './gameHistory';
import { buildResumeNavigationState, boardRouteParamsFromSnapshot } from './initialNavigation';
import type { ActiveGameSnapshot } from './activeGameSnapshot';

const AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function inProgressBotSnapshot(): ActiveGameSnapshot {
  return {
    mode: 'bot',
    botId: 'gary',
    session: appendMove(createGameSession('Gary the Pigeon'), 'e4', AFTER_E4),
    boardOrientation: 'white',
    playerColor: 'w',
    passAndPlayEnabled: false,
    savedAt: 1_700_000_000_000,
  };
}

describe('buildResumeNavigationState', () => {
  it('returns undefined when there is no snapshot', () => {
    assert.equal(buildResumeNavigationState(null), undefined);
  });

  it('returns undefined for finished games', () => {
    assert.equal(
      buildResumeNavigationState({ ...inProgressBotSnapshot(), finished: true }),
      undefined,
    );
  });

  it('opens Board with resume for an in-progress bot game', () => {
    const state = buildResumeNavigationState(inProgressBotSnapshot());
    assert.equal(state?.index, 1);
    assert.deepEqual(state?.routes?.[1], {
      name: 'Board',
      params: { mode: 'bot', botId: 'gary', resume: true },
    });
  });

  it('opens Board with resume for an in-progress free game', () => {
    const snapshot: ActiveGameSnapshot = {
      ...inProgressBotSnapshot(),
      mode: 'free',
      botId: undefined,
    };
    const state = buildResumeNavigationState(snapshot);
    assert.deepEqual(state?.routes?.[1], {
      name: 'Board',
      params: { mode: 'free', resume: true },
    });
  });

  it('returns undefined when bot id is unknown', () => {
    const snapshot = { ...inProgressBotSnapshot(), botId: 'missing-bot' };
    assert.equal(buildResumeNavigationState(snapshot), undefined);
  });
});

describe('boardRouteParamsFromSnapshot', () => {
  it('maps free snapshots to free resume params', () => {
    assert.deepEqual(
      boardRouteParamsFromSnapshot({ ...inProgressBotSnapshot(), mode: 'free', botId: undefined }),
      { mode: 'free', resume: true },
    );
  });
});
