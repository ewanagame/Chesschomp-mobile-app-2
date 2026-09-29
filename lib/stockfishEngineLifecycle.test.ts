import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  StockfishEngineInstanceGuard,
  isEngineUsable,
  lifecycleAfterDestroy,
  lifecycleAfterGoCommand,
  lifecycleAfterPause,
  lifecycleAfterPauseComplete,
  lifecycleAfterReadyOk,
  lifecycleAfterSearchComplete,
  lifecycleOnMount,
} from './stockfishEngineLifecycle';

describe('Stockfish engine lifecycle', () => {
  it('Scenario 1: idle app — engine not usable before mount', () => {
    assert.equal(isEngineUsable('IDLE'), false);
    assert.equal(isEngineUsable('DESTROYED'), false);
  });

  it('Scenario 2: entering board — mount transitions to LOADING then READY', () => {
    assert.equal(lifecycleOnMount(), 'LOADING');
    assert.equal(lifecycleAfterReadyOk(), 'READY');
    assert.equal(isEngineUsable('READY'), true);
  });

  it('Scenario 3: leaving board — destroy ends in DESTROYED', () => {
    assert.equal(lifecycleAfterDestroy(), 'DESTROYED');
    assert.equal(isEngineUsable('DESTROYED'), false);
  });

  it('Scenario 4: background while analyzing — pause stops search', () => {
    assert.equal(lifecycleAfterGoCommand('READY'), 'ANALYZING');
    assert.equal(lifecycleAfterPause('ANALYZING'), 'STOPPING');
    assert.equal(lifecycleAfterPauseComplete('STOPPING'), 'READY');
  });

  it('Scenario 5: foreground — no automatic reload from STOPPING/READY', () => {
    assert.equal(lifecycleAfterPauseComplete('STOPPING'), 'READY');
    assert.equal(lifecycleAfterSearchComplete('ANALYZING'), 'READY');
    assert.equal(lifecycleOnMount(), 'LOADING');
  });

  it('go command tracking during search completion', () => {
    assert.equal(lifecycleAfterSearchComplete('ANALYZING'), 'READY');
    assert.equal(lifecycleAfterSearchComplete('STOPPING'), 'READY');
  });

  it('undo stop bestmove clears STOPPING back to READY', () => {
    assert.equal(lifecycleAfterPause('ANALYZING'), 'STOPPING');
    assert.equal(lifecycleAfterSearchComplete('STOPPING'), 'READY');
    assert.equal(isEngineUsable('READY'), true);
  });

  it('pause while loading does not destroy engine boot', () => {
    assert.equal(lifecycleAfterPause('LOADING'), 'LOADING');
    assert.equal(lifecycleAfterPause('DESTROYED'), 'DESTROYED');
  });

  it('stop while idle does not flicker through STOPPING', () => {
    assert.equal(lifecycleAfterPause('READY'), 'READY');
    assert.equal(lifecycleAfterPause('IDLE'), 'IDLE');
    assert.equal(isEngineUsable('READY'), true);
  });
});

describe('StockfishEngineInstanceGuard', () => {
  it('allows a single provider instance', () => {
    const guard = new StockfishEngineInstanceGuard();
    const ownerA = Symbol('provider-a');

    assert.equal(guard.tryAcquire(ownerA), true);
    assert.equal(guard.hasActiveInstance(), true);
    assert.equal(guard.tryAcquire(Symbol('provider-b')), false);

    guard.release(ownerA);
    assert.equal(guard.hasActiveInstance(), false);
  });

  it('forceRelease clears stale singleton lock', () => {
    const guard = new StockfishEngineInstanceGuard();
    const first = Symbol('first');
    const second = Symbol('second');

    assert.equal(guard.tryAcquire(first), true);
    guard.forceRelease();
    assert.equal(guard.tryAcquire(second), true);
  });
});
