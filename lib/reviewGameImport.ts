import { Chess, DEFAULT_POSITION } from 'chess.js';

import { toPgn, type GameSession } from './gameHistory';
import { normalizeSavedGameName } from './savedGameName';
import {
  createSavedGameId,
  defaultSavedGameName,
  type CachedReview,
  type SavedGame,
} from './savedGames';

export type ReviewGameData = {
  moves: string[];
  fens: string[];
  pgn: string;
  result: string;
  playerColor: 'w' | 'b';
  mode: 'free' | 'bot';
  botId?: string;
  opponent: string;
};

export type ParsedPgnResult =
  | { ok: true; data: ReviewGameData }
  | { ok: false; error: string };

export type ParsedFenResult =
  | { ok: true; data: ReviewGameData }
  | { ok: false; error: string };

function sessionFromMoves(moves: string[], opponent: string): GameSession {
  const chess = new Chess();
  const fens: string[] = [];

  for (const san of moves) {
    const result = chess.move(san);
    if (!result) {
      throw new Error(`Unable to replay move: ${san}`);
    }
    fens.push(chess.fen());
  }

  return {
    moves,
    fens,
    currentIndex: moves.length - 1,
    opponent,
    startedAt: Date.now(),
  };
}

function inferResult(chess: Chess): string {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? 'Black wins' : 'White wins';
  }
  if (chess.isDraw()) {
    return 'Draw';
  }
  return 'Game in progress';
}

export function parsePgnForReview(rawPgn: string): ParsedPgnResult {
  const trimmed = rawPgn.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste a PGN to review.' };
  }

  try {
    const chess = new Chess();
    chess.loadPgn(trimmed);

    const moves = chess.history();
    if (moves.length === 0) {
      return { ok: false, error: 'PGN contains no moves.' };
    }

    const whiteHeader = chess.header().White?.trim();
    const blackHeader = chess.header().Black?.trim();
    const opponent = blackHeader && blackHeader !== '?' ? blackHeader : 'Opponent';
    const session = sessionFromMoves(moves, opponent);

    return {
      ok: true,
      data: {
        moves: session.moves,
        fens: session.fens,
        pgn: trimmed,
        result: chess.header().Result && chess.header().Result !== '*'
          ? chess.header().Result!
          : inferResult(chess),
        playerColor: 'w',
        mode: 'free',
        opponent,
      },
    };
  } catch {
    return { ok: false, error: 'Could not parse PGN. Check the format and try again.' };
  }
}

export function parseFenForReview(rawFen: string): ParsedFenResult {
  const trimmed = rawFen.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste a FEN to review.' };
  }

  try {
    const chess = new Chess(trimmed);
    const opponent = 'Position';
    const session: GameSession = {
      moves: [],
      fens: [chess.fen()],
      currentIndex: 0,
      opponent,
      startedAt: Date.now(),
    };

    return {
      ok: true,
      data: {
        moves: session.moves,
        fens: session.fens,
        pgn: `[FEN "${chess.fen()}"]\n\n*`,
        result: inferResult(chess),
        playerColor: chess.turn(),
        mode: 'free',
        opponent,
      },
    };
  } catch {
    return { ok: false, error: 'Could not parse FEN. Check the format and try again.' };
  }
}

export function reviewDataFromSavedGame(game: {
  moves: string[];
  fens: string[];
  pgn: string;
  result: string;
  playerColor: 'w' | 'b';
  mode: 'free' | 'bot';
  botId?: string;
  name: string;
}): ReviewGameData {
  return {
    moves: game.moves,
    fens: game.fens,
    pgn: game.pgn,
    result: game.result,
    playerColor: game.playerColor,
    mode: game.mode,
    botId: game.botId,
    opponent: game.name,
  };
}

export function buildPgnFromReviewData(data: ReviewGameData): string {
  if (data.pgn.trim()) {
    return data.pgn;
  }

  const session: GameSession = {
    moves: data.moves,
    fens: data.fens,
    currentIndex: data.moves.length - 1,
    opponent: data.opponent,
    startedAt: Date.now(),
  };
  return toPgn(session);
}

export function startingFenForReview(data: ReviewGameData): string {
  return data.moves.length === 0 ? data.fens[0] ?? DEFAULT_POSITION : DEFAULT_POSITION;
}

export function suggestedReviewSaveName(data: ReviewGameData): string {
  if (data.mode === 'bot') {
    return defaultSavedGameName({ mode: 'bot', botName: data.opponent });
  }
  if (data.opponent && data.opponent !== 'Opponent' && data.opponent !== 'Review') {
    return normalizeSavedGameName(data.opponent) ?? defaultSavedGameName({ mode: 'free' });
  }
  return defaultSavedGameName({ mode: 'free' });
}

export function buildSavedGameFromReview(
  data: ReviewGameData,
  name: string,
  review?: CachedReview,
): SavedGame | null {
  if (data.moves.length === 0) {
    return null;
  }

  const normalizedName = normalizeSavedGameName(name);
  if (!normalizedName) {
    return null;
  }

  return {
    id: createSavedGameId(),
    name: normalizedName,
    pgn: buildPgnFromReviewData(data),
    moves: [...data.moves],
    fens: [...data.fens],
    mode: data.mode,
    botId: data.botId,
    playerColor: data.playerColor,
    result: data.result,
    savedAt: Date.now(),
    ...(review != null ? { review } : {}),
  };
}
