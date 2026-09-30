import type { ImageSourcePropType } from 'react-native';

/** Metro module ids only — skip { uri } objects. */
export function imageModuleIds(sources: readonly ImageSourcePropType[]): number[] {
  return sources.filter((source): source is number => typeof source === 'number');
}
