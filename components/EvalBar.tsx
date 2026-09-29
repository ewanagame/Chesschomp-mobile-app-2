import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { type BoardOrientation } from '../lib/boardOrientation';
import { formatEvalLabel } from '../lib/evalBarLabel';
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
  /** Align white's edge with white's side of the board (bottom when playing as White). */
  boardOrientation?: BoardOrientation;
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

export default function EvalBar({
  height,
  eval: evalState,
  boardOrientation = 'white',
}: EvalBarProps) {
  const targetFill = whiteFillPercent(evalState);
  const fillAnim = useRef(new Animated.Value(targetFill)).current;
  const whiteAtBottom = boardOrientation === 'white';

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: targetFill,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, targetFill]);

  const label = formatEvalLabel(evalState);
  const whiteIsWinning = targetFill >= 50;
  const labelOnWhiteSide = whiteIsWinning;
  const whiteHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, height],
  });
  const blackHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [height, 0],
  });

  const labelPositionStyle =
    labelOnWhiteSide === whiteAtBottom ? styles.labelOnBottom : styles.labelOnTop;
  const labelTextStyle = labelOnWhiteSide ? styles.labelOnWhiteBg : styles.labelOnBlackBg;

  return (
    <View style={[styles.container, { height, width: BAR_WIDTH }]}>
      <View
        style={[
          styles.track,
          { height },
          whiteAtBottom ? styles.trackWhiteAtBottom : styles.trackWhiteAtTop,
        ]}
      >
        <Animated.View style={[styles.whiteSection, { height: whiteHeight }]} />
        <Animated.View style={[styles.blackSection, { height: blackHeight }]} />
      </View>

      <View pointerEvents="none" style={[styles.labelHost, labelPositionStyle]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling={false}
          style={[styles.labelTextBase, labelTextStyle]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  track: {
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'column',
  },
  trackWhiteAtTop: {
    flexDirection: 'column',
  },
  trackWhiteAtBottom: {
    flexDirection: 'column-reverse',
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
    left: -6,
    right: -6,
    alignItems: 'center',
    overflow: 'visible',
  },
  labelOnTop: {
    top: 6,
  },
  labelOnBottom: {
    bottom: 6,
  },
  labelTextBase: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 36,
    flexShrink: 0,
  },
  labelOnWhiteBg: {
    color: '#1a1a1a',
    textShadowColor: 'rgba(255, 255, 255, 0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  labelOnBlackBg: {
    color: '#f5f5f5',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
