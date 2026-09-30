import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { normalizeClassifiedMove } from './classifiedMoves';
import { normalizeSavedGameName } from './savedGameName';

export type CachedReview = {
  depth: number;
  classifiedMoves: ClassifiedMoveRecord[];
  analyzedAt: number;
  analysisVersion?: number;
};

export type SavedGame = {
  id: string;
  name: string;
  pgn: string;
  moves: string[];
  fens: string[];
  mode: 'free' | 'bot';
  botId?: string;
  playerColor: 'w' | 'b';
  result: string;
  savedAt: number;
  review?: CachedReview;
};

/** Make a review safe to JSON.stringify. Non-finite evals become 0. */
export function sanitizeCachedReview(review: CachedReview): CachedReview | null {
  const classifiedMoves = review.classifiedMoves
    .map(normalizeClassifiedMove)
    .filter((move): move is ClassifiedMoveRecord => move != null);
  if (classifiedMoves.length !== review.classifiedMoves.length || classifiedMoves.length === 0) {
    return null;
  }
  if (typeof review.depth !== 'number' || typeof review.analyzedAt !== 'number') {
    return null;
  }
  return {
    depth: review.depth,
    classifiedMoves,
    analyzedAt: review.analyzedAt,
    ...(review.analysisVersion != null ? { analysisVersion: review.analysisVersion } : {}),
  };
}

function parseCachedReview(value: unknown): CachedReview | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const review = value as Partial<CachedReview>;
  if (
    typeof review.depth !== 'number' ||
    !Array.isArray(review.classifiedMoves) ||
    typeof review.analyzedAt !== 'number' ||
    (review.analysisVersion != null && typeof review.analysisVersion !== 'number')
  ) {
    return null;
  }

  return sanitizeCachedReview({
    depth: review.depth,
    classifiedMoves: review.classifiedMoves as ClassifiedMoveRecord[],
    analyzedAt: review.analyzedAt,
    analysisVersion: review.analysisVersion,
  });
}

export function parseSavedGame(raw: unknown): SavedGame | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const game = raw as Partial<SavedGame>;
  if (typeof game.id !== 'string' || typeof game.name !== 'string') {
    return null;
  }

  if (typeof game.pgn !== 'string') {
    return null;
  }

  if (!Array.isArray(game.moves) || !game.moves.every((move) => typeof move === 'string')) {
    return null;
  }

  if (!Array.isArray(game.fens) || !game.fens.every((fen) => typeof fen === 'string')) {
    return null;
  }

  if (game.mode !== 'free' && game.mode !== 'bot') {
    return null;
  }

  if (game.mode === 'bot' && typeof game.botId !== 'string') {
    return null;
  }

  if (game.playerColor !== 'w' && game.playerColor !== 'b') {
    return null;
  }

  if (typeof game.result !== 'string' || typeof game.savedAt !== 'number') {
    return null;
  }

  if (game.moves.length === 0) {
    return null;
  }

  const name = normalizeSavedGameName(game.name);
  if (!name) {
    return null;
  }

  const review = game.review == null ? undefined : parseCachedReview(game.review) ?? undefined;

  return {
    id: game.id,
    name,
    pgn: game.pgn,
    moves: game.moves,
    fens: game.fens,
    mode: game.mode,
    botId: game.mode === 'bot' ? game.botId : undefined,
    playerColor: game.playerColor,
    result: game.result,
    savedAt: game.savedAt,
    ...(review != null ? { review } : {}),
  };
}

export function createSavedGameId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultSavedGameName(params: {
  mode: 'free' | 'bot';
  botName?: string;
  savedAt?: number;
}): string {
  const date = new Date(params.savedAt ?? Date.now());
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const raw =
    params.mode === 'bot' && params.botName
      ? `vs ${params.botName} - ${label}`
      : `Free Board - ${label}`;
  return normalizeSavedGameName(raw) ?? 'Saved game';
}

export function parseSavedGamesFile(raw: unknown): SavedGame[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const file = raw as { games?: unknown };
  if (!Array.isArray(file.games)) {
    return [];
  }

  return file.games
    .map(parseSavedGame)
    .filter((game): game is SavedGame => game != null)
    .sort((left, right) => right.savedAt - left.savedAt);
}

/** Drops one saved game (and its nested evaluation) from the list. */
export function removeSavedGameById(
  games: readonly SavedGame[],
  id: string,
): SavedGame[] | null {
  const nextGames = games.filter((game) => game.id !== id);
  if (nextGames.length === games.length) {
    return null;
  }
  return nextGames;
}
