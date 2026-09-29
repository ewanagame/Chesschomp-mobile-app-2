import { Chess, type Color, type Move } from 'chess.js';

import { sideToMoveHasMateInOne } from './botMaterialSearch';
import type { BotMove } from './botOpponent';
import { ANALYSIS_CANCELLED, isAnalysisCancelled, type RegisterAnalysisCancel } from './stockfishCancel';
import { evalCentipawnsForColor } from './stockfishAnalysis';
import { isAnalysisCompleteLine, parseInfoLine } from './uciParse';

export const LOSING_BOT_EVAL_DEPTH = 8;

const BOT_DIAG = typeof __DEV__ !== 'undefined' && __DEV__;

function plyFromFen(fen: string): number {
  const parts = fen.split(' ');
  const turn = parts[1];
  const fullmove = parseInt(parts[5] ?? '1', 10);
  return (fullmove - 1) * 2 + (turn === 'b' ? 1 : 0);
}

function diagLog(message: string, data?: Record<string, unknown>) {
  if (!BOT_DIAG) {
    return;
  }
  if (data) {
    console.log(`[Bot Diag] ${message}`, data);
  } else {
    console.log(`[Bot Diag] ${message}`);
  }
}

function moveToBotMove(move: Move): BotMove {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  };
}

function pickRandomMove(moves: Move[]): BotMove {
  const move = moves[Math.floor(Math.random() * moves.length)];
  return moveToBotMove(move);
}

/**
 * True when the opponent can immediately capture one of the bot's pieces with no recapture.
 */
export function moveAllowsFreeCapture(fen: string, move: Move, botColor: Color): boolean {
  const chess = new Chess(fen);
  const applied = chess.move(move);
  if (!applied) {
    return false;
  }

  const humanColor: Color = botColor === 'w' ? 'b' : 'w';
  const humanCaptures = chess.moves({ verbose: true }).filter(
    (candidate) => candidate.color === humanColor && candidate.captured,
  );

  for (const capture of humanCaptures) {
    const afterCapture = new Chess(chess.fen());
    const captureResult = afterCapture.move(capture);
    if (!captureResult) {
      continue;
    }

    const botRecaptures = afterCapture.moves({ verbose: true }).filter(
      (candidate) =>
        candidate.color === botColor && candidate.to === capture.to && Boolean(candidate.captured),
    );

    if (botRecaptures.length === 0) {
      return true;
    }
  }

  return false;
}

/** True when a losing bot's move leaves the opponent with an immediate checkmate available. */
function moveAllowsOpponentMateInOne(fen: string, move: Move): boolean {
  const trial = new Chess(fen);
  if (!trial.move(move)) {
    return false;
  }
  return sideToMoveHasMateInOne(trial.fen());
}

function isForcedBlunderMove(fen: string, move: Move, botColor: Color): boolean {
  return (
    moveAllowsFreeCapture(fen, move, botColor) || moveAllowsOpponentMateInOne(fen, move)
  );
}

function evaluatePositionAtDepth(
  fen: string,
  perspective: Color,
  sendCommand: (command: string) => void,
  addLineListener: (listener: (line: string) => void) => () => void,
  registerAnalysisCancel: RegisterAnalysisCancel,
  depth = LOSING_BOT_EVAL_DEPTH,
  evalIndex?: number,
  evalTotal?: number,
): Promise<number> {
  const startedAt = Date.now();
  const evalLabel =
    evalIndex != null && evalTotal != null ? `${evalIndex}/${evalTotal}` : '?/?';
  diagLog('evaluatePositionAtDepth start', { evalLabel, fen, depth, perspective });

  return new Promise((resolve, reject) => {
    let settled = false;
    let latestInfo = null as ReturnType<typeof parseInfoLine> | null;

    function settle(onSettle: () => void, outcome: string, extra?: Record<string, unknown>) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      diagLog('evaluatePositionAtDepth end', {
        evalLabel,
        fen,
        outcome,
        elapsedMs: Date.now() - startedAt,
        ...extra,
      });
      onSettle();
    }

    const timeoutId = setTimeout(() => {
      settle(
        () => {
          reject(new Error(`Losing-bot eval timed out for fen: ${fen}`));
        },
        'timeout',
      );
    }, depth * 400 + 2_000);

    const unsubscribe = addLineListener((line) => {
      const info = parseInfoLine(line);
      if (info && (info.multipv == null || info.multipv === 1)) {
        latestInfo = info;
      }

      if (isAnalysisCompleteLine(line)) {
        const evalForBot = evalCentipawnsForColor(fen, perspective, latestInfo);
        if (evalForBot == null) {
          settle(
            () => {
              reject(new Error(`Losing-bot eval missing score for fen: ${fen}`));
            },
            'missing_score',
          );
          return;
        }
        settle(
          () => {
            resolve(evalForBot);
          },
          'resolved',
          { evalForBot },
        );
      }
    });

    const unregisterCancel = registerAnalysisCancel(() => {
      settle(
        () => {
          reject(new Error(ANALYSIS_CANCELLED));
        },
        'cancelled',
      );
    });

    function cleanup() {
      clearTimeout(timeoutId);
      unsubscribe();
      unregisterCancel();
    }

    try {
      sendCommand('stop');
      sendCommand(`position fen ${fen}`);
      sendCommand(`go depth ${depth}`);
    } catch (error) {
      settle(
        () => {
          reject(error instanceof Error ? error : new Error(String(error)));
        },
        'send_command_error',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  });
}

/** Losing-bot personality: actively hunt the worst move, not just play weak chess. */
export async function chooseLosingBotMove(
  fen: string,
  sendCommand: (command: string) => void,
  addLineListener: (listener: (line: string) => void) => () => void,
  registerAnalysisCancel: RegisterAnalysisCancel,
): Promise<BotMove | null> {
  const chess = new Chess(fen);
  const botColor = chess.turn();
  const legalMoves = chess.moves({ verbose: true });
  const ply = plyFromFen(fen);

  diagLog('chooseLosingBotMove entry', {
    ply,
    botColor,
    legalMoveCount: legalMoves.length,
    fen,
  });

  if (legalMoves.length === 0) {
    diagLog('chooseLosingBotMove return', { path: 'no_legal_moves', move: null });
    return null;
  }

  if (legalMoves.length === 1) {
    const move = moveToBotMove(legalMoves[0]);
    diagLog('chooseLosingBotMove return', { path: 'single_legal_move', move });
    return move;
  }

  const forcedBlunders = legalMoves.filter((move) => isForcedBlunderMove(fen, move, botColor));
  if (forcedBlunders.length > 0) {
    const move = pickRandomMove(forcedBlunders);
    diagLog('chooseLosingBotMove return', {
      path: 'forced_blunder_shortcut',
      forcedBlunderCount: forcedBlunders.length,
      move,
    });
    return move;
  }

  diagLog('chooseLosingBotMove full eval path', {
    ply,
    legalMoveCount: legalMoves.length,
  });

  let worstEval = Number.POSITIVE_INFINITY;
  const worstMoves: Move[] = [];

  for (let index = 0; index < legalMoves.length; index++) {
    const move = legalMoves[index];
    const trial = new Chess(fen);
    trial.move(move);

    let evalForBot: number;
    try {
      evalForBot = await evaluatePositionAtDepth(
        trial.fen(),
        botColor,
        sendCommand,
        addLineListener,
        registerAnalysisCancel,
        LOSING_BOT_EVAL_DEPTH,
        index + 1,
        legalMoves.length,
      );
    } catch (error) {
      if (isAnalysisCancelled(error)) {
        diagLog('chooseLosingBotMove aborted', {
          path: 'full_eval_cancelled',
          progress: `${index + 1}/${legalMoves.length}`,
          move: `${move.from}${move.to}`,
        });
        throw error;
      }
      diagLog('chooseLosingBotMove eval skipped', {
        progress: `${index + 1}/${legalMoves.length}`,
        move: `${move.from}${move.to}`,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    diagLog('chooseLosingBotMove eval complete', {
      progress: `${index + 1}/${legalMoves.length}`,
      move: `${move.from}${move.to}`,
      evalForBot,
    });

    if (evalForBot < worstEval) {
      worstEval = evalForBot;
      worstMoves.length = 0;
      worstMoves.push(move);
    } else if (evalForBot === worstEval) {
      worstMoves.push(move);
    }
  }

  if (worstMoves.length === 0) {
    const move = pickRandomMove(legalMoves);
    diagLog('chooseLosingBotMove return', {
      path: 'full_eval_fallback_random',
      move,
    });
    return move;
  }

  const move = pickRandomMove(worstMoves);
  diagLog('chooseLosingBotMove return', {
    path: 'full_eval_worst',
    worstEval,
    worstMoveCount: worstMoves.length,
    move,
  });
  return move;
}
