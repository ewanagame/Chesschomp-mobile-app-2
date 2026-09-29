import { Chess, DEFAULT_POSITION } from 'chess.js';

import { formatMoveHistory } from './moveHistory';

export type GameSession = {
  moves: string[];
  fens: string[];
  currentIndex: number;
  opponent: string;
  startedAt: number;
};

export function createGameSession(opponent: string): GameSession {
  return {
    moves: [],
    fens: [],
    currentIndex: -1,
    opponent,
    startedAt: Date.now(),
  };
}

export function appendMove(session: GameSession, san: string, fen: string): GameSession {
  const moves = [...session.moves, san];
  const fens = [...session.fens, fen];
  return {
    ...session,
    moves,
    fens,
    currentIndex: moves.length - 1,
  };
}

export function goToIndex(session: GameSession, index: number): GameSession | null {
  if (index < -1 || index >= session.moves.length) {
    return null;
  }

  if (index === session.currentIndex) {
    return null;
  }

  return {
    ...session,
    currentIndex: index,
  };
}

export function goBack(session: GameSession): GameSession {
  return goToIndex(session, session.currentIndex - 1) ?? session;
}

export function goForward(session: GameSession): GameSession {
  return goToIndex(session, session.currentIndex + 1) ?? session;
}

/** SAN moves replayed through the current index (empty at the starting position). */
export function movesThroughIndex(session: GameSession): readonly string[] {
  if (session.currentIndex < 0) {
    return [];
  }

  return session.moves.slice(0, session.currentIndex + 1);
}

export function truncateAndAppend(session: GameSession, san: string, fen: string): GameSession {
  if (session.currentIndex === session.moves.length - 1) {
    return appendMove(session, san, fen);
  }

  const keepUntil = session.currentIndex + 1;
  return appendMove(
    {
      ...session,
      moves: session.moves.slice(0, keepUntil),
      fens: session.fens.slice(0, keepUntil),
    },
    san,
    fen,
  );
}

export function popLastMove(session: GameSession): GameSession {
  if (session.moves.length === 0) {
    return session;
  }

  const moves = session.moves.slice(0, -1);
  const fens = session.fens.slice(0, -1);
  return {
    ...session,
    moves,
    fens,
    currentIndex: moves.length - 1,
  };
}

export function toPgn(session: GameSession): string {
  const chess = new Chess();
  chess.setHeader('White', 'Player');
  chess.setHeader('Black', session.opponent || 'Opponent');
  chess.setHeader('Date', formatPgnDate(session.startedAt));

  try {
    for (const san of session.moves) {
      const result = chess.move(san);
      if (!result) {
        throw new Error(`Unable to replay move: ${san}`);
      }
    }
    return chess.pgn();
  } catch {
    const moves = formatMoveHistory(session.moves);
    return [
      `[White "Player"]`,
      `[Black "${escapePgnHeader(session.opponent || 'Opponent')}"]`,
      `[Date "${formatPgnDate(session.startedAt)}"]`,
      '',
      moves || '*',
    ].join('\n');
  }
}

export function toFen(session: GameSession): string {
  if (session.currentIndex < 0) {
    return DEFAULT_POSITION;
  }

  return session.fens[session.currentIndex] ?? DEFAULT_POSITION;
}

function formatPgnDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function escapePgnHeader(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
