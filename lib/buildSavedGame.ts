import { Chess } from 'chess.js';

import type { ActiveGameSnapshot } from './activeGameSnapshot';
import { describeGameResult } from './gameResult';
import { toFen, toPgn } from './gameHistory';
import { getBotById } from './bots';
import { normalizeSavedGameName } from './savedGameName';
import {
  createSavedGameId,
  defaultSavedGameName,
  type SavedGame,
} from './savedGames';

export function buildSavedGameFromSnapshot(
  snapshot: ActiveGameSnapshot,
  name: string,
  resultOverride?: string,
): SavedGame {
  const bot = snapshot.mode === 'bot' && snapshot.botId ? getBotById(snapshot.botId) : undefined;
  const chess = new Chess(toFen(snapshot.session));
  const result = resultOverride ?? describeGameResult(chess, false);

  const normalizedName = normalizeSavedGameName(name);
  if (!normalizedName) {
    throw new Error('Saved game name cannot be empty.');
  }

  return {
    id: createSavedGameId(),
    name: normalizedName,
    pgn: toPgn(snapshot.session),
    moves: [...snapshot.session.moves],
    fens: [...snapshot.session.fens],
    mode: snapshot.mode,
    botId: snapshot.botId,
    playerColor: snapshot.playerColor,
    result,
    savedAt: Date.now(),
  };
}

export function suggestedSavedGameName(snapshot: ActiveGameSnapshot): string {
  const bot = snapshot.mode === 'bot' && snapshot.botId ? getBotById(snapshot.botId) : undefined;
  return defaultSavedGameName({
    mode: snapshot.mode,
    botName: bot?.name,
  });
}
