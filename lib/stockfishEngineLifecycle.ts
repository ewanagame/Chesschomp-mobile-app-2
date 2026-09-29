export type EngineLifecycleState =
  | 'IDLE'
  | 'LOADING'
  | 'READY'
  | 'ANALYZING'
  | 'STOPPING'
  | 'DESTROYED';

export function isEngineUsable(state: EngineLifecycleState): boolean {
  return state === 'READY' || state === 'ANALYZING';
}

export function lifecycleAfterUciOk(): EngineLifecycleState {
  return 'LOADING';
}

export function lifecycleAfterReadyOk(): EngineLifecycleState {
  return 'READY';
}

export function lifecycleAfterGoCommand(current: EngineLifecycleState): EngineLifecycleState {
  if (current === 'READY' || current === 'ANALYZING') {
    return 'ANALYZING';
  }
  return current;
}

export function lifecycleAfterSearchComplete(current: EngineLifecycleState): EngineLifecycleState {
  if (current === 'ANALYZING' || current === 'STOPPING') {
    return 'READY';
  }
  return current;
}

export function lifecycleAfterPause(current: EngineLifecycleState): EngineLifecycleState {
  if (current === 'DESTROYED') {
    return 'DESTROYED';
  }
  if (current === 'LOADING') {
    return 'LOADING';
  }
  // Idle stop (losing bot per-candidate `stop` after bestmove) must not leave READY.
  // STOPPING flickers isEngineReady and cancels the bot-turn effect.
  if (current === 'READY' || current === 'IDLE') {
    return current;
  }
  return 'STOPPING';
}

export function lifecycleAfterPauseComplete(current: EngineLifecycleState): EngineLifecycleState {
  if (current === 'STOPPING') {
    return 'READY';
  }
  return current;
}

export function lifecycleAfterDestroy(): EngineLifecycleState {
  return 'DESTROYED';
}

export function lifecycleOnMount(): EngineLifecycleState {
  return 'LOADING';
}

/** Ensures at most one StockfishEngineProvider instance boots a WebView. */
export class StockfishEngineInstanceGuard {
  private ownerId: symbol | null = null;

  tryAcquire(ownerId: symbol): boolean {
    if (this.ownerId != null && this.ownerId !== ownerId) {
      return false;
    }
    this.ownerId = ownerId;
    return true;
  }

  release(ownerId: symbol): void {
    if (this.ownerId === ownerId) {
      this.ownerId = null;
    }
  }

  /** Clears a stale lock after an unmount that did not release (defensive recovery). */
  forceRelease(): void {
    this.ownerId = null;
  }

  hasActiveInstance(): boolean {
    return this.ownerId != null;
  }

  get activeOwnerId(): symbol | null {
    return this.ownerId;
  }
}

export const stockfishEngineInstanceGuard = new StockfishEngineInstanceGuard();
