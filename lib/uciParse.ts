export type SearchInfo = {
  depth?: number;
  scoreCp?: number;
  scoreMate?: number;
  pv?: string[];
};

export type BestMove = {
  uci: string;
  ponder?: string;
};

export function parseInfoLine(line: string): SearchInfo | null {
  if (!line.startsWith('info ')) {
    return null;
  }

  const parts = line.split(/\s+/);
  const info: SearchInfo = {};

  for (let i = 0; i < parts.length; i += 1) {
    const token = parts[i];
    if (token === 'depth') {
      info.depth = Number(parts[++i]);
    } else if (token === 'score') {
      const kind = parts[++i];
      const value = Number(parts[++i]);
      if (kind === 'cp') {
        info.scoreCp = value;
      } else if (kind === 'mate') {
        info.scoreMate = value;
      }
    } else if (token === 'pv') {
      info.pv = parts.slice(i + 1);
      break;
    }
  }

  return info.depth != null || info.scoreCp != null || info.scoreMate != null ? info : null;
}

export function parseBestMove(line: string): BestMove | null {
  if (!line.startsWith('bestmove ')) {
    return null;
  }

  const parts = line.split(/\s+/);
  const uci = parts[1];
  if (!uci || uci === '(none)') {
    return null;
  }

  const ponderIndex = parts.indexOf('ponder');
  return {
    uci,
    ponder: ponderIndex >= 0 ? parts[ponderIndex + 1] : undefined,
  };
}

/** True when Stockfish finished search, including terminal positions with no legal move. */
export function isAnalysisCompleteLine(line: string): boolean {
  return line.startsWith('bestmove ');
}

export function formatEvaluation(info: SearchInfo | null): string {
  if (!info) {
    return '(pending)';
  }
  if (info.scoreCp != null) {
    return `${(info.scoreCp / 100).toFixed(2)} pawns (depth ${info.depth ?? '?'})`;
  }
  if (info.scoreMate != null) {
    return `Mate in ${Math.abs(info.scoreMate)} (depth ${info.depth ?? '?'})`;
  }
  return '(pending)';
}
