import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function countMaterial(chess: Chess, color: Color): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.color === color) {
        total += PIECE_VALUES[piece.type];
      }
    }
  }
  return total;
}

function opponentColor(mover: Color): Color {
  return mover === 'w' ? 'b' : 'w';
}

/** Mover's material minus the opponent's. Positive means the mover is ahead. */
function materialBalance(chess: Chess, mover: Color): number {
  return countMaterial(chess, mover) - countMaterial(chess, opponentColor(mover));
}

function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/**
 * Cheapest legal capture of the piece that just moved. Used only when the
 * post-move engine reply is not available. A rational recapture uses the
 * least valuable attacker, not the most valuable one.
 */
function cheapestRecaptureUci(fenAfter: string, move: Move, mover: Color): string | null {
  const chess = new Chess(fenAfter);
  const recaptures = chess
    .moves({ verbose: true })
    .filter(
      (candidate) =>
        candidate.color === opponentColor(mover) &&
        candidate.to === move.to &&
        Boolean(candidate.captured),
    );
  if (recaptures.length === 0) {
    return null;
  }

  recaptures.sort((left, right) => PIECE_VALUES[left.piece] - PIECE_VALUES[right.piece]);
  return moveToUci(recaptures[0]);
}

/**
 * Material the mover loses with best play after their move, in piece points.
 * Applies the opponent's best reply, then the mover's recapture when one
 * exists, so a protected piece is not scored as lost for free.
 */
function materialLossWithBestReply(
  fenBefore: string,
  fenAfter: string,
  mover: Color,
  replyUci: string,
): number | null {
  const balanceBefore = materialBalance(new Chess(fenBefore), mover);
  const afterReply = new Chess(fenAfter);
  const reply = applyUciMove(afterReply, replyUci);
  if (!reply || reply.color === mover) {
    return null;
  }

  if (reply.captured) {
    const takeBacks = afterReply
      .moves({ verbose: true })
      .filter(
        (candidate) =>
          candidate.color === mover && candidate.to === reply.to && Boolean(candidate.captured),
      );
    if (takeBacks.length > 0) {
      let bestBalance = Number.NEGATIVE_INFINITY;
      for (const takeBack of takeBacks) {
        const trial = new Chess(afterReply.fen());
        trial.move(takeBack);
        bestBalance = Math.max(bestBalance, materialBalance(trial, mover));
      }
      return balanceBefore - bestBalance;
    }
  }

  return balanceBefore - materialBalance(afterReply, mover);
}

/**
 * True when best play after this move leaves the mover down at least 2 points.
 *
 * The opponent's reply is Stockfish's top move from the post-move search when
 * that move is known. That reply can capture the moved piece or a different
 * piece that was left hanging. Without an engine move, the fallback is the
 * cheapest recapture of the moved piece only.
 */
export function isMaterialSacrifice(
  fenBefore: string,
  fenAfter: string,
  move: Move,
  mover: Color,
  opponentBestReplyUci?: string | null,
): boolean {
  const replyUci = opponentBestReplyUci || cheapestRecaptureUci(fenAfter, move, mover);
  if (!replyUci) {
    return false;
  }

  const materialLoss = materialLossWithBestReply(fenBefore, fenAfter, mover, replyUci);
  const isSacrifice = materialLoss != null && materialLoss >= 2;

  // #region agent log
  fetch('http://127.0.0.1:7562/ingest/f0f54059-4f5e-4d5d-86e5-cd12521b175e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0fcc09'},body:JSON.stringify({sessionId:'0fcc09',location:'lib/materialEval.ts:isMaterialSacrifice',message:'sacrifice check',data:{san:move.san,mover,replyUci,engineReply:opponentBestReplyUci??null,materialLoss,isSacrifice},timestamp:Date.now(),hypothesisId:'sacrifice-reply'})}).catch(()=>{});
  // #endregion

  return isSacrifice;
}

/** Minimum net material gain (after recapture) to count as a clear winning opportunity. */
export const MIN_MISSED_MATERIAL_GAIN = 2;

/** Best line must beat the played move by at least this much material to count as a miss. */
export const MIN_MISSED_MATERIAL_DELTA = 2;

function applyUciMove(chess: Chess, uci: string): Move | null {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;

  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}

/**
 * Net material change for the mover after their move and the opponent's best recapture
 * on the destination square (if any). Positive = material gained.
 */
export function netMaterialGainAfterUci(fen: string, uci: string): number | null {
  const chess = new Chess(fen);
  const mover = chess.turn();
  const materialBefore = countMaterial(chess, mover);

  const move = applyUciMove(chess, uci);
  if (!move) {
    return null;
  }

  const opponentRecaptures = chess
    .moves({ verbose: true })
    .filter(
      (candidate) =>
        candidate.color !== mover && candidate.to === move.to && Boolean(candidate.captured),
    );

  if (opponentRecaptures.length === 0) {
    return countMaterial(chess, mover) - materialBefore;
  }

  let materialAfterWorstRecapture = materialBefore;
  for (const recapture of opponentRecaptures) {
    const trial = new Chess(chess.fen());
    trial.move(recapture);
    materialAfterWorstRecapture = Math.min(
      materialAfterWorstRecapture,
      countMaterial(trial, mover),
    );
  }

  return materialAfterWorstRecapture - materialBefore;
}

export function netMaterialGainAfterMove(fen: string, move: Move): number | null {
  return netMaterialGainAfterUci(fen, `${move.from}${move.to}${move.promotion ?? ''}`);
}

/**
 * True when the engine's best move wins clear material (free capture or winning trade)
 * and the played move passes up most of that gain.
 */
export function isMissedMaterialOpportunity(
  fenBefore: string,
  bestMoveUci: string,
  playedMove: Move,
): boolean {
  if (!bestMoveUci) {
    return false;
  }

  const playedUci = `${playedMove.from}${playedMove.to}${playedMove.promotion ?? ''}`;
  if (playedUci.toLowerCase() === bestMoveUci.toLowerCase()) {
    return false;
  }

  const bestGain = netMaterialGainAfterUci(fenBefore, bestMoveUci);
  if (bestGain == null || bestGain < MIN_MISSED_MATERIAL_GAIN) {
    return false;
  }

  const playedGain = netMaterialGainAfterMove(fenBefore, playedMove) ?? 0;
  if (bestGain - playedGain < MIN_MISSED_MATERIAL_DELTA) {
    return false;
  }

  const trial = new Chess(fenBefore);
  const bestMove = applyUciMove(trial, bestMoveUci);
  if (!bestMove) {
    return false;
  }

  const hasRecapture = trial
    .moves({ verbose: true })
    .some(
      (candidate) =>
        candidate.color !== playedMove.color &&
        candidate.to === bestMove.to &&
        Boolean(candidate.captured),
    );

  if (!hasRecapture && bestMove.captured) {
    return true;
  }

  return bestGain >= 3;
}
