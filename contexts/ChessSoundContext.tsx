import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';

import { CHESS_SOUND_ASSETS, CHESS_SOUND_PLAYER_OPTIONS } from '../lib/chessSoundAssets';
import { resolveMoveSoundEvent, shouldUseChompCaptureSound, type ChessMoveSoundEvent } from '../lib/chessMoveSound';
import { saveSoundEnabled } from '../lib/soundPreferences';
import { useChompSoundEnabledRef } from './AppPreferencesContext';
import type { Chess, Move } from 'chess.js';
import type { Color } from 'chess.js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const ILLEGAL_SOUND_THROTTLE_MS = 200;

type PooledMoveSoundEvent = 'move-self' | 'move-opponent' | 'capture';

type ChessSoundContextValue = {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  playMoveSound: (move: Move, gameAfterMove: Chess, playerColor: Color) => void;
  playBrilliantSound: () => void;
  playIllegalSound: () => void;
};

const ChessSoundContext = createContext<ChessSoundContextValue | null>(null);

let audioSessionReadyPromise: Promise<void> | null = null;

function ensureAudioSessionReady(): Promise<void> {
  if (!audioSessionReadyPromise) {
    audioSessionReadyPromise = (async () => {
      await setIsAudioActiveAsync(true);
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
      });
    })();
  }
  return audioSessionReadyPromise;
}

function playImmediately(player: AudioPlayer) {
  if (player.playing || player.currentTime > 0.001) {
    void player.seekTo(0).then(() => {
      player.play();
    });
    return;
  }

  player.play();
}

function useSoundPool(source: number) {
  const player0 = useAudioPlayer(source, CHESS_SOUND_PLAYER_OPTIONS);
  const player1 = useAudioPlayer(source, CHESS_SOUND_PLAYER_OPTIONS);
  const cursorRef = useRef(0);

  useEffect(() => {
    void ensureAudioSessionReady().then(() => {
      for (const player of [player0, player1]) {
        const previousVolume = player.volume;
        player.volume = 0.001;
        player.play();
        player.pause();
        void player.seekTo(0);
        player.volume = previousVolume;
      }
    });
  }, [player0, player1]);

  return useCallback(() => {
    const players = [player0, player1];
    const player = players[cursorRef.current];
    cursorRef.current = cursorRef.current === 0 ? 1 : 0;
    playImmediately(player);
  }, [player0, player1]);
}

export function ChessSoundProvider({
  children,
  initialSoundEnabled = true,
}: {
  children: ReactNode;
  initialSoundEnabled?: boolean;
}) {
  const [soundEnabled, setSoundEnabledState] = useState(initialSoundEnabled);
  const soundEnabledRef = useRef(initialSoundEnabled);

  const playMoveSelf = useSoundPool(CHESS_SOUND_ASSETS['move-self']);
  const playMoveOpponent = useSoundPool(CHESS_SOUND_ASSETS['move-opponent']);
  const playCapture = useSoundPool(CHESS_SOUND_ASSETS.capture);
  const playChompCapture = useSoundPool(CHESS_SOUND_ASSETS['chomp-capture']);
  const playChompCaptureAlt = useSoundPool(CHESS_SOUND_ASSETS['chomp-capture-alt']);
  const playBrilliant = useSoundPool(CHESS_SOUND_ASSETS.brilliant);

  const chompSoundEnabledRef = useChompSoundEnabledRef();

  const checkPlayer = useAudioPlayer(CHESS_SOUND_ASSETS.check, CHESS_SOUND_PLAYER_OPTIONS);
  const castlePlayer = useAudioPlayer(CHESS_SOUND_ASSETS.castle, CHESS_SOUND_PLAYER_OPTIONS);
  const promotePlayer = useAudioPlayer(CHESS_SOUND_ASSETS.promote, CHESS_SOUND_PLAYER_OPTIONS);
  const illegalPlayer = useAudioPlayer(CHESS_SOUND_ASSETS.illegal, CHESS_SOUND_PLAYER_OPTIONS);
  const checkmateWinPlayer = useAudioPlayer(CHESS_SOUND_ASSETS['checkmate-win'], CHESS_SOUND_PLAYER_OPTIONS);
  const checkmateLossPlayer = useAudioPlayer(CHESS_SOUND_ASSETS['checkmate-loss'], CHESS_SOUND_PLAYER_OPTIONS);

  const lastIllegalSoundAtRef = useRef(0);

  const playRandomChompCapture = useCallback(() => {
    if (Math.random() < 0.5) {
      playChompCapture();
      return;
    }
    playChompCaptureAlt();
  }, [playChompCapture, playChompCaptureAlt]);

  const pooledPlaybacks = useMemo(
    () =>
      ({
        'move-self': playMoveSelf,
        'move-opponent': playMoveOpponent,
        capture: playCapture,
      }) satisfies Record<PooledMoveSoundEvent, () => void>,
    [playCapture, playMoveOpponent, playMoveSelf],
  );

  const singlePlayers = useMemo(
    () =>
      ({
        check: checkPlayer,
        castle: castlePlayer,
        promote: promotePlayer,
        'checkmate-win': checkmateWinPlayer,
        'checkmate-loss': checkmateLossPlayer,
      }) satisfies Partial<Record<ChessMoveSoundEvent, AudioPlayer>>,
    [castlePlayer, checkPlayer, checkmateLossPlayer, checkmateWinPlayer, promotePlayer],
  );

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    void ensureAudioSessionReady().then(() => {
      const warmUpPlayers = [
        checkPlayer,
        castlePlayer,
        promotePlayer,
        illegalPlayer,
        checkmateWinPlayer,
        checkmateLossPlayer,
      ];

      for (const player of warmUpPlayers) {
        const previousVolume = player.volume;
        player.volume = 0.001;
        player.play();
        player.pause();
        void player.seekTo(0);
        player.volume = previousVolume;
      }
    });
  }, [
    castlePlayer,
    checkPlayer,
    checkmateLossPlayer,
    checkmateWinPlayer,
    illegalPlayer,
    promotePlayer,
  ]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    soundEnabledRef.current = enabled;
    setSoundEnabledState(enabled);
    void saveSoundEnabled(enabled);
  }, []);

  const playEventSound = useCallback(
    (event: ChessMoveSoundEvent) => {
      if (!soundEnabledRef.current) {
        return;
      }

      void ensureAudioSessionReady();

      if (event === 'move-self' || event === 'move-opponent' || event === 'capture') {
        pooledPlaybacks[event]();
        return;
      }

      const player = singlePlayers[event];
      if (player) {
        playImmediately(player);
      }
    },
    [pooledPlaybacks, singlePlayers],
  );

  const playMoveSound = useCallback(
    (move: Move, gameAfterMove: Chess, playerColor: Color) => {
      if (!soundEnabledRef.current) {
        return;
      }

      if (shouldUseChompCaptureSound(move, gameAfterMove, chompSoundEnabledRef.current)) {
        void ensureAudioSessionReady();
        playRandomChompCapture();
        return;
      }

      const event = resolveMoveSoundEvent(move, gameAfterMove, playerColor);
      playEventSound(event);
    },
    [chompSoundEnabledRef, playEventSound, playRandomChompCapture],
  );

  const playBrilliantSound = useCallback(() => {
    if (!soundEnabledRef.current) {
      return;
    }

    void ensureAudioSessionReady();
    playBrilliant();
  }, [playBrilliant]);

  const playIllegalSound = useCallback(() => {
    if (!soundEnabledRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastIllegalSoundAtRef.current < ILLEGAL_SOUND_THROTTLE_MS) {
      return;
    }
    lastIllegalSoundAtRef.current = now;

    void ensureAudioSessionReady();
    playImmediately(illegalPlayer);
  }, [illegalPlayer]);

  const value = useMemo(
    () => ({
      soundEnabled,
      setSoundEnabled,
      playMoveSound,
      playBrilliantSound,
      playIllegalSound,
    }),
    [playBrilliantSound, playIllegalSound, playMoveSound, setSoundEnabled, soundEnabled],
  );

  return <ChessSoundContext.Provider value={value}>{children}</ChessSoundContext.Provider>;
}

export function useChessSound() {
  const context = useContext(ChessSoundContext);
  if (!context) {
    throw new Error('useChessSound must be used within ChessSoundProvider');
  }
  return context;
}

export function preloadChessSounds(): Promise<void> {
  return ensureAudioSessionReady();
}
