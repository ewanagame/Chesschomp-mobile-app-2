import type { ColorScheme } from '../theme/types';

export const PLAY_TOGETHER_TITLE = 'Play Together';

export const PLAY_TOGETHER_TAGLINE = 'Your move. Their move. One phone.';

export const PLAY_TOGETHER_DESCRIPTION =
  'Two people, one phone. On Free Board, tap Play Together — after each move, the board flips on its own so there is no need to get up or rotate the phone.';

/** Native promo art ratio (~1024×438). */
export const PLAY_TOGETHER_IMAGE_ASPECT_RATIO = 1024 / 438;

export function playTogetherImageSource(scheme: ColorScheme) {
  return scheme === 'light'
    ? require('../assets/play-together-light.jpg')
    : require('../assets/play-together-dark.jpg');
}
