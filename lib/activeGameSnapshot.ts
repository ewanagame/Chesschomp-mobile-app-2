import type { BoardOrientation } from './boardOrientation';
import type { GameSession } from './gameHistory';

export type ActiveGameSnapshot = {
  mode: 'free' | 'bot';
  botId?: string;
  session: GameSession;
  boardOrientation: BoardOrientation;
  playerColor: 'w' | 'b';
  passAndPlayEnabled: boolean;
  savedAt: number;
  /** True after checkmate, draw, or resignation. Resume still works; bot games stay locked. */
  finished?: boolean;
};

function isGameSession(value: unknown): value is GameSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<GameSession>;
  return (
    Array.isArray(session.moves) &&
    session.moves.every((move) => typeof move === 'string') &&
    Array.isArray(session.fens) &&
    session.fens.every((fen) => typeof fen === 'string') &&
    typeof session.currentIndex === 'number' &&
    typeof session.opponent === 'string' &&
    typeof session.startedAt === 'number'
  );
}

export function parseActiveGameSnapshot(raw: unknown): ActiveGameSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const snapshot = raw as Partial<ActiveGameSnapshot>;
  if (snapshot.mode !== 'free' && snapshot.mode !== 'bot') {
    return null;
  }

  if (snapshot.mode === 'bot' && typeof snapshot.botId !== 'string') {
    return null;
  }

  if (!isGameSession(snapshot.session)) {
    return null;
  }

  if (snapshot.boardOrientation !== 'white' && snapshot.boardOrientation !== 'black') {
    return null;
  }

  if (snapshot.playerColor !== 'w' && snapshot.playerColor !== 'b') {
    return null;
  }

  if (typeof snapshot.passAndPlayEnabled !== 'boolean') {
    return null;
  }

  if (typeof snapshot.savedAt !== 'number') {
    return null;
  }

  if (snapshot.session.moves.length === 0) {
    return null;
  }

  return {
    mode: snapshot.mode,
    botId: snapshot.mode === 'bot' ? snapshot.botId : undefined,
    session: snapshot.session,
    boardOrientation: snapshot.boardOrientation,
    playerColor: snapshot.playerColor,
    passAndPlayEnabled: snapshot.passAndPlayEnabled,
    savedAt: snapshot.savedAt,
    ...(snapshot.finished === true ? { finished: true } : {}),
  };
}

export function isFinishedActiveGame(snapshot: ActiveGameSnapshot): boolean {
  return snapshot.finished === true;
}
