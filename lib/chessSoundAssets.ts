import { preload } from 'expo-audio';

export const CHESS_SOUND_ASSETS = {
  'move-self': require('../assets/sounds/move.mp3'),
  'move-opponent': require('../assets/sounds/move-opponent.mp3'),
  capture: require('../assets/sounds/capture.mp3'),
  'chomp-capture': require('../assets/sounds/chomp_capture.mp3'),
  'chomp-capture-alt': require('../assets/sounds/chomp_capture_alt.mp3'),
  brilliant: require('../assets/sounds/brilliant.mp3'),
  check: require('../assets/sounds/check.mp3'),
  castle: require('../assets/sounds/castle.mp3'),
  promote: require('../assets/sounds/promote.mp3'),
  illegal: require('../assets/sounds/illegal.mp3'),
  'checkmate-win': require('../assets/sounds/checkmate-win.mp3'),
  'checkmate-loss': require('../assets/sounds/checkmate-loss.mp3'),
} as const;

for (const source of Object.values(CHESS_SOUND_ASSETS)) {
  void preload(source);
}

export type ChessSoundAssetKey = keyof typeof CHESS_SOUND_ASSETS;

export const CHESS_SOUND_PLAYER_OPTIONS = {
  keepAudioSessionActive: true,
  updateInterval: 1000,
} as const;
