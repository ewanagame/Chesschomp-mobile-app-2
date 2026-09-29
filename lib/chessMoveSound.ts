import { Chess, DEFAULT_POSITION, type Move } from 'chess.js';
import type { Color } from 'chess.js';

import type { ClassifiedMoveRecord } from '../hooks/useMoveClassification';
import { parseUciMove } from './uciParse';

export type ChessMoveSoundEvent =
  | 'move-self'
  | 'move-opponent'
  | 'capture'
  | 'check'
  | 'castle'
  | 'promote'
  | 'checkmate-win'
  | 'checkmate-loss';

function isCastleMove(move: Move): boolean {
  return move.flags.includes('k') || move.flags.includes('q');
}

function isPromotionMove(move: Move): boolean {
  return Boolean(move.promotion) || move.flags.includes('p');
}

function isCaptureMove(move: Move): boolean {
  return Boolean(move.captured);
}

/** Check, checkmate, and captures wait for classification so a Brilliant rating can replace them. */
export function moveSoundYieldsToBrilliant(move: Move, gameAfterMove: Chess): boolean {
  return gameAfterMove.isCheckmate() || gameAfterMove.inCheck() || Boolean(move.captured);
}

/** When enabled, any non-checkmate capture uses chomp SFX instead of capture/check/castle/promote. */
export function shouldUseChompCaptureSound(
  move: Move,
  gameAfterMove: Chess,
  chompSoundEnabled: boolean,
): boolean {
  return chompSoundEnabled && isCaptureMove(move) && !gameAfterMove.isCheckmate();
}

/** Pick one board SFX for a move that was just applied (game is already updated). */
export function resolveMoveSoundEvent(
  move: Move,
  gameAfterMove: Chess,
  playerColor: Color,
): ChessMoveSoundEvent {
  if (gameAfterMove.isCheckmate()) {
    const playerWasMated = gameAfterMove.turn() === playerColor;
    return playerWasMated ? 'checkmate-loss' : 'checkmate-win';
  }

  if (gameAfterMove.inCheck()) {
    return 'check';
  }

  if (isCastleMove(move)) {
    return 'castle';
  }

  if (isPromotionMove(move)) {
    return 'promote';
  }

  if (isCaptureMove(move)) {
    return 'capture';
  }

  return move.color === playerColor ? 'move-self' : 'move-opponent';
}

export function replayMoveFromRecord(
  record: ClassifiedMoveRecord,
): { move: Move; gameAfterMove: Chess } | null {
  const parsed = parseUciMove(record.move);
  if (!parsed) {
    return null;
  }

  const fen = record.fenBefore === 'startpos' ? DEFAULT_POSITION : record.fenBefore;
  const chess = new Chess(fen);
  const move = chess.move({
    from: parsed.from,
    to: parsed.to,
    promotion: parsed.promotion,
  });

  if (!move) {
    return null;
  }

  return { move, gameAfterMove: chess };
}
