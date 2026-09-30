import { REVIEW_AUTOPLAY_MS } from './reviewSettings';

/** Hold < or > steps at this multiple of review autoplay. */
export const DEFAULT_HISTORY_HOLD_SPEED = 2;
/** Double-tap and hold steps at this multiple of review autoplay. */
export const DEFAULT_HISTORY_DOUBLE_HOLD_SPEED = 4;

export const HISTORY_NAV_SPEED_MIN = 0.5;
export const HISTORY_NAV_SPEED_MAX = 8;
export const HISTORY_NAV_SPEED_STEP = 0.01;

/** Second press within this window is a double-tap hold. */
export const DOUBLE_TAP_HOLD_MS = 320;

export function clampHistoryNavSpeed(speed: number, fallback = DEFAULT_HISTORY_HOLD_SPEED): number {
  if (!Number.isFinite(speed)) {
    return fallback;
  }

  const snapped =
    Math.round((speed - HISTORY_NAV_SPEED_MIN) / HISTORY_NAV_SPEED_STEP) * HISTORY_NAV_SPEED_STEP +
    HISTORY_NAV_SPEED_MIN;
  const clamped = Math.min(HISTORY_NAV_SPEED_MAX, Math.max(HISTORY_NAV_SPEED_MIN, snapped));
  return Math.round(clamped * 100) / 100;
}

export function formatHistoryNavSpeedLabel(speed: number): string {
  const clamped = clampHistoryNavSpeed(speed);
  const text = Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(2).replace(/0$/, '');
  return `${text}×`;
}

export function historyNavIntervalMs(speed: number): number {
  return REVIEW_AUTOPLAY_MS / clampHistoryNavSpeed(speed);
}

export function isDoubleTapHold(
  lastReleaseAt: number | null,
  pressAt: number,
  windowMs = DOUBLE_TAP_HOLD_MS,
): boolean {
  if (lastReleaseAt == null) {
    return false;
  }
  const elapsed = pressAt - lastReleaseAt;
  return elapsed >= 0 && elapsed <= windowMs;
}

export type HoldRepeatHandle = {
  start: () => void;
  stop: () => void;
};

type HoldRepeatTimers = {
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

export function createHoldRepeat(options: {
  step: () => void;
  isEnabled?: () => boolean;
  intervalMs: number | (() => number);
  timers?: Partial<HoldRepeatTimers>;
}): HoldRepeatHandle {
  const timers: HoldRepeatTimers = {
    setInterval,
    clearInterval,
    ...options.timers,
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (intervalId != null) {
      timers.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tick() {
    if (options.isEnabled && !options.isEnabled()) {
      stop();
      return;
    }
    options.step();
  }

  function start() {
    stop();
    if (options.isEnabled && !options.isEnabled()) {
      return;
    }
    const intervalMs = typeof options.intervalMs === 'function' ? options.intervalMs() : options.intervalMs;
    options.step();
    intervalId = timers.setInterval(tick, intervalMs);
  }

  return { start, stop };
}
