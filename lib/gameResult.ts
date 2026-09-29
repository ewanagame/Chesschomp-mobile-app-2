import type { Chess } from 'chess.js';
import type { Color } from 'chess.js';

export type GameOutcome = {
  result: string;
  /** Plain-language draw reason for the result screen; null for wins and non-draw endings. */
  explanation: string | null;
};

export function describeResignation(playerColor: Color): string {
  const resigned = playerColor === 'w' ? 'White' : 'Black';
  const winner = playerColor === 'w' ? 'Black' : 'White';
  return `${winner} wins — ${resigned} resigned`;
}

export function describeGameResult(game: Chess, endedEarly: boolean): string {
  if (endedEarly) {
    return 'Game ended early';
  }

  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'Black' : 'White';
    return `${winner} wins by checkmate`;
  }

  if (game.isStalemate()) {
    return 'Draw by stalemate';
  }

  if (game.isInsufficientMaterial()) {
    return 'Draw by insufficient material';
  }

  if (game.isThreefoldRepetition()) {
    return 'Draw by threefold repetition';
  }

  if (game.isDrawByFiftyMoves()) {
    return 'Draw by fifty-move rule';
  }

  if (game.isDraw()) {
    return 'Draw';
  }

  return 'Game over';
}

/** One-sentence draw explainer for the post-game overlay. */
export function getDrawExplanation(game: Chess, endedEarly = false): string | null {
  if (endedEarly || game.isCheckmate()) {
    return null;
  }

  if (game.isStalemate()) {
    return 'The side to move is not in check but has no legal moves. That is a draw by stalemate — not a win for the other player.';
  }

  if (game.isInsufficientMaterial()) {
    return 'Neither side has enough pieces left to force checkmate, so the game is a draw.';
  }

  if (game.isThreefoldRepetition()) {
    return 'This exact position occurred three times, so the game is a draw by repetition.';
  }

  if (game.isDrawByFiftyMoves()) {
    return 'Fifty moves passed without a pawn move or capture, so the game is a draw.';
  }

  if (game.isDraw()) {
    return 'The position is a draw under standard chess rules.';
  }

  return null;
}

export function buildGameOutcome(
  game: Chess,
  options: { endedEarly?: boolean; resignedColor?: Color } = {},
): GameOutcome {
  if (options.resignedColor) {
    return {
      result: describeResignation(options.resignedColor),
      explanation: null,
    };
  }

  const endedEarly = options.endedEarly ?? false;
  return {
    result: describeGameResult(game, endedEarly),
    explanation: getDrawExplanation(game, endedEarly),
  };
}
