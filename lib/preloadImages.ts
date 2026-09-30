import { Asset } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';

import { BOTS } from './bots';
import { CHECKMATE_ASSETS } from './checkmateAssets';
import { imageModuleIds } from './imageModuleIds';

export { imageModuleIds } from './imageModuleIds';

export const HOME_MASCOT_SOURCE = require('../assets/splash.png') as ImageSourcePropType;

const PLAY_TOGETHER_DARK_SOURCE = require('../assets/play-together-dark.jpg') as ImageSourcePropType;
const PLAY_TOGETHER_LIGHT_SOURCE = require('../assets/play-together-light.jpg') as ImageSourcePropType;

export function startupImageSources(): ImageSourcePropType[] {
  return [HOME_MASCOT_SOURCE];
}

export function deferredImageSources(): ImageSourcePropType[] {
  return [
    ...BOTS.flatMap((bot) => [bot.imageSourceDark, bot.imageSourceLight]),
    PLAY_TOGETHER_DARK_SOURCE,
    PLAY_TOGETHER_LIGHT_SOURCE,
    CHECKMATE_ASSETS.sword,
    CHECKMATE_ASSETS.crown,
  ];
}

export async function preloadImageSources(sources: readonly ImageSourcePropType[]): Promise<void> {
  const modules = imageModuleIds(sources);
  if (modules.length === 0) {
    return;
  }

  try {
    await Asset.loadAsync(modules);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Images] preload failed:', message);
  }
}

export function preloadStartupImages(): Promise<void> {
  return preloadImageSources(startupImageSources());
}

export function preloadDeferredImages(): Promise<void> {
  return preloadImageSources(deferredImageSources());
}
