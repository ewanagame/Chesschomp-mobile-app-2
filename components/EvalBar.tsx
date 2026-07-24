import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { type LivePositionEval } from '../lib/liveEval';
import { centipawnsToWinPercent } from '../utils/moveClassification';

const BAR_WIDTH = 24;
const EVAL_BAR_CP_CAP = 800;
const MATE_FILL_PERCENT = 99;
const MIN_FILL_PERCENT = 2;
const MAX_FILL_PERCENT = 98;

type EvalBarProps = {
  height: number;
  eval: LivePositionEval;
};

function whiteFillPercent(evalState: LivePositionEval): number {
  if (evalState.isNeutral) {
    return 50;
  }

  if (evalState.mateInWhite != null) {
    return evalState.mateInWhite > 0 ? MATE_FILL_PERCENT : 100 - MATE_FILL_PERCENT;
  }

  const cappedCp = Math.max(
    -EVAL_BAR_CP_CAP,
    Math.min(EVAL_BAR_CP_CAP, evalState.centipawnsWhite),
  );
  const winPercent = centipawnsToWinPercent(cappedCp);
  return Math.max(MIN_FILL_PERCENT, Math.min(MAX_FILL_PERCENT, winPercent));
}

export function formatEvalLabel(evalState: LivePositionEval): string {
  if (evalState.isNeutral) {
    return '0.0';
  }

  if (evalState.mateInWhite != null) {
    if (evalState.mateInWhite > 0) {
      return `M${evalState.mateInWhite}`;
    }
    return `-M${Math.abs(evalState.mateInWhite)}`;
  }

  const pawns = evalState.centipawnsWhite / 100;
  const magnitude = Math.abs(pawns).toFixed(1);
  if (pawns > 0) {
    return `+${magnitude}`;
  }
  if (pawns < 0) {
    return `-${magnitude}`;
  }
  return '0.0';
}

export default function EvalBar({ height, eval: evalState }: EvalBarProps) {
  const targetFill = whiteFillPercent(evalState);
  const fillAnim = useRef(new Animated.Value(targetFill)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: targetFill,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, targetFill]);

  const label = formatEvalLabel(evalState);
  const labelOnWhiteSide = targetFill >= 50;
  const whiteHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, height],
  });
  const blackHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [height, 0],
  });

  return (
    <View style={[styles.container, { height, width: BAR_WIDTH }]}>
      <View style={[styles.track, { height }]}>
        <Animated.View style={[styles.whiteSection, { height: whiteHeight }]} />
        <Animated.View style={[styles.blackSection, { height: blackHeight }]} />
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.labelHost,
          labelOnWhiteSide ? styles.labelOnWhite : styles.labelOnBlack,
        ]}
      >
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 6,
    position: 'relative',
  },
  track: {
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'column',
  },
  whiteSection: {
    backgroundColor: '#f0f0f0',
    width: '100%',
  },
  blackSection: {
    backgroundColor: '#262421',
    width: '100%',
  },
  labelHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  labelOnWhite: {
    top: 6,
  },
  labelOnBlack: {
    bottom: 6,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
