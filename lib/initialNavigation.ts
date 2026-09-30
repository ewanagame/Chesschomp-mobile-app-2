import type { PartialState, NavigationState } from '@react-navigation/native';

import type { ActiveGameSnapshot } from './activeGameSnapshot';
import { isFinishedActiveGame } from './activeGameSnapshot';
import { isKnownBotId } from './botIds';
import type { RootStackParamList } from '../navigation/types';

export function boardRouteParamsFromSnapshot(
  snapshot: ActiveGameSnapshot,
): RootStackParamList['Board'] {
  if (snapshot.mode === 'bot' && snapshot.botId) {
    return { mode: 'bot', botId: snapshot.botId, resume: true };
  }

  return { mode: 'free', resume: true };
}

/** When an in-progress game exists, open the board on launch with Home underneath for back. */
export function buildResumeNavigationState(
  snapshot: ActiveGameSnapshot | null,
): PartialState<NavigationState> | undefined {
  if (!snapshot || isFinishedActiveGame(snapshot)) {
    return undefined;
  }

  if (snapshot.mode === 'bot') {
    if (!snapshot.botId || !isKnownBotId(snapshot.botId)) {
      return undefined;
    }
  }

  return {
    index: 1,
    routes: [{ name: 'Home' }, { name: 'Board', params: boardRouteParamsFromSnapshot(snapshot) }],
  };
}
