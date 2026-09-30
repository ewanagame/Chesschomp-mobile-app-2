import { useCallback, useEffect, useRef } from 'react';

import { createHoldRepeat, isDoubleTapHold } from '../lib/holdRepeat';

type HoldRepeatSpeeds = {
  singleIntervalMs: number;
  doubleIntervalMs: number;
};

/**
 * Hold a control to keep firing `step`. A normal hold uses the single-tap
 * interval. A second press that starts soon after a release, and stays down,
 * uses the double-tap interval. `onPress` is only for accessibility
 * activations that never send press-in.
 */
export function useHoldRepeat(step: () => void, enabled: boolean, speeds: HoldRepeatSpeeds) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const singleIntervalRef = useRef(speeds.singleIntervalMs);
  singleIntervalRef.current = speeds.singleIntervalMs;
  const doubleIntervalRef = useRef(speeds.doubleIntervalMs);
  doubleIntervalRef.current = speeds.doubleIntervalMs;
  const lastReleaseAtRef = useRef<number | null>(null);
  const fastHoldRef = useRef(false);
  const handledByPressRef = useRef(false);

  const holdRef = useRef<ReturnType<typeof createHoldRepeat> | null>(null);
  if (holdRef.current == null) {
    holdRef.current = createHoldRepeat({
      step: () => stepRef.current(),
      isEnabled: () => enabledRef.current,
      intervalMs: () => (fastHoldRef.current ? doubleIntervalRef.current : singleIntervalRef.current),
    });
  }
  const hold = holdRef.current;

  useEffect(() => {
    if (!enabled) {
      hold.stop();
    }
  }, [enabled, hold]);

  useEffect(() => () => hold.stop(), [hold]);

  const onPressIn = useCallback(() => {
    handledByPressRef.current = true;
    fastHoldRef.current = isDoubleTapHold(lastReleaseAtRef.current, Date.now());
    hold.start();
  }, [hold]);

  const onPressOut = useCallback(() => {
    lastReleaseAtRef.current = Date.now();
    hold.stop();
  }, [hold]);

  const onPress = useCallback(() => {
    if (handledByPressRef.current) {
      handledByPressRef.current = false;
      return;
    }
    if (!enabledRef.current) {
      return;
    }
    stepRef.current();
  }, []);

  return { onPress, onPressIn, onPressOut };
}
