import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampHistoryNavSpeed,
  createHoldRepeat,
  formatHistoryNavSpeedLabel,
  historyNavIntervalMs,
  isDoubleTapHold,
} from './holdRepeat';
import { reviewAutoplayDelayMs } from './reviewSettings';

describe('move hold repeat', () => {
  it('matches review autoplay at the default hold speeds', () => {
    assert.equal(historyNavIntervalMs(2), reviewAutoplayDelayMs(2));
    assert.equal(historyNavIntervalMs(2), 225);
    assert.equal(historyNavIntervalMs(4), reviewAutoplayDelayMs(2) / 2);
    assert.equal(historyNavIntervalMs(4), 112.5);
  });

  it('clamps and labels navigation speeds', () => {
    assert.equal(clampHistoryNavSpeed(0.1), 0.5);
    assert.equal(clampHistoryNavSpeed(99), 8);
    assert.equal(clampHistoryNavSpeed(2.004), 2);
    assert.equal(formatHistoryNavSpeedLabel(2), '2×');
    assert.equal(formatHistoryNavSpeedLabel(2.5), '2.5×');
  });

  it('treats a second press shortly after release as a double-tap hold', () => {
    assert.equal(isDoubleTapHold(null, 1_000), false);
    assert.equal(isDoubleTapHold(1_000, 1_200), true);
    assert.equal(isDoubleTapHold(1_000, 1_500), false);
  });

  it('steps immediately then repeats until stopped', () => {
    const steps: number[] = [];
    const intervals: Array<() => void> = [];
    const hold = createHoldRepeat({
      step: () => steps.push(steps.length + 1),
      intervalMs: 225,
      timers: {
        setInterval: (fn) => {
          intervals.push(fn as () => void);
          return 1 as unknown as ReturnType<typeof setInterval>;
        },
        clearInterval: () => {
          intervals.length = 0;
        },
      },
    });

    hold.start();
    assert.deepEqual(steps, [1]);
    assert.equal(intervals.length, 1);

    const intervalsAtStart: Array<{ delay?: number }> = [];
    const timed = createHoldRepeat({
      step: () => undefined,
      intervalMs: () => 112.5,
      timers: {
        setInterval: (_fn, delay) => {
          intervalsAtStart.push({ delay });
          return 7 as unknown as ReturnType<typeof setInterval>;
        },
        clearInterval: () => undefined,
      },
    });
    timed.start();
    assert.equal(intervalsAtStart[0]?.delay, 112.5);

    intervals[0]();
    intervals[0]();
    assert.deepEqual(steps, [1, 2, 3]);

    hold.stop();
    assert.equal(intervals.length, 0);
  });

  it('does nothing when disabled at start', () => {
    let calls = 0;
    const hold = createHoldRepeat({
      step: () => {
        calls += 1;
      },
      isEnabled: () => false,
      intervalMs: 225,
    });

    hold.start();
    assert.equal(calls, 0);
  });

  it('stops repeating once isEnabled becomes false', () => {
    let enabled = true;
    const steps: number[] = [];
    const intervals: Array<() => void> = [];
    const hold = createHoldRepeat({
      step: () => steps.push(steps.length + 1),
      isEnabled: () => enabled,
      intervalMs: 225,
      timers: {
        setInterval: (fn) => {
          intervals.push(fn as () => void);
          return 1 as unknown as ReturnType<typeof setInterval>;
        },
        clearInterval: () => {
          intervals.length = 0;
        },
      },
    });

    hold.start();
    enabled = false;
    intervals[0]();
    assert.deepEqual(steps, [1]);
    assert.equal(intervals.length, 0);
  });
});
