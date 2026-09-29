import type { Square } from 'chess.js';
import type { Color } from 'chess.js';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { CHECKMATE_ASSETS } from '../lib/checkmateAssets';
import { getSquareCenter } from '../lib/boardGeometry';
import { type BoardOrientation } from '../lib/boardOrientation';

export const CHECKMATE_OVERLAY_FADE_MS = 180;
export const CHECKMATE_OVERLAY_HOLD_MS = 1500;

type CheckmateOverlayProps = {
  matingSquare: Square;
  winningKingSquare: Square;
  losingKingSquare: Square;
  squareSize: number;
  boardOrientation: BoardOrientation;
  playerColor?: Color;
  effectKey: number;
  onComplete: () => void;
};

import { swordRotationDegrees } from '../lib/checkmateOverlayMath';

export default function CheckmateOverlay({
  matingSquare,
  winningKingSquare,
  losingKingSquare,
  squareSize,
  boardOrientation,
  playerColor = 'w',
  effectKey,
  onComplete,
}: CheckmateOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  const matingCenter = getSquareCenter(matingSquare, squareSize, boardOrientation, playerColor);
  const winningCenter = getSquareCenter(winningKingSquare, squareSize, boardOrientation, playerColor);
  const losingCenter = getSquareCenter(losingKingSquare, squareSize, boardOrientation, playerColor);

  const swordSize = squareSize * 0.72;
  const crownSize = squareSize * 0.46;
  const loserBadgeSize = squareSize * 0.34;
  const swordRotation = swordRotationDegrees(
    matingCenter.x,
    matingCenter.y,
    losingCenter.x,
    losingCenter.y,
  );

  useEffect(() => {
    opacity.setValue(0);
    let holdTimeout: ReturnType<typeof setTimeout> | null = null;

    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: CHECKMATE_OVERLAY_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    fadeIn.start(({ finished }) => {
      if (!finished) {
        return;
      }

      holdTimeout = setTimeout(() => {
        onComplete();
      }, CHECKMATE_OVERLAY_HOLD_MS);
    });

    return () => {
      fadeIn.stop();
      if (holdTimeout) {
        clearTimeout(holdTimeout);
      }
    };
  }, [effectKey, onComplete, opacity]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <View
          style={[
            styles.swordHost,
            {
              left: matingCenter.x - swordSize / 2,
              top: matingCenter.y - swordSize / 2,
              width: swordSize,
              height: swordSize,
              transform: [{ rotate: `${swordRotation}deg` }],
            },
          ]}
        >
          <Image source={CHECKMATE_ASSETS.sword} style={styles.swordImage} resizeMode="contain" />
        </View>

        <View
          style={[
            styles.crownHost,
            {
              left: winningCenter.x - crownSize / 2,
              top: winningCenter.y - crownSize * 0.72,
              width: crownSize,
              height: crownSize,
            },
          ]}
        >
          <Image source={CHECKMATE_ASSETS.crown} style={styles.crownImage} resizeMode="contain" />
        </View>

        <View
          style={[
            styles.loserBadge,
            {
              left: losingCenter.x - loserBadgeSize / 2,
              top: losingCenter.y - loserBadgeSize / 2,
              width: loserBadgeSize,
              height: loserBadgeSize,
              borderRadius: loserBadgeSize * 0.22,
            },
          ]}
        >
          <Text style={[styles.loserBadgeText, { fontSize: loserBadgeSize * 0.62 }]}>L</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swordHost: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swordImage: {
    width: '100%',
    height: '100%',
  },
  crownHost: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownImage: {
    width: '100%',
    height: '100%',
  },
  loserBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 24, 24, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 180, 180, 0.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  loserBadgeText: {
    color: '#ffe8e8',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
