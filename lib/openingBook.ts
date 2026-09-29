import ecoBookData from '../assets/openings/eco-book.json';

export type EcoOpeningLine = {
  eco: string;
  name: string;
  moves: string[];
};

export type OpeningMatch = {
  eco: string;
  name: string;
};

type EcoBookFile = {
  sourceRepository: string;
  lineCount: number;
  lines: EcoOpeningLine[];
};

type TrieNode = {
  children: Map<string, TrieNode>;
  opening?: OpeningMatch;
};

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]+$/g, '');
}

/** Display label for UI (e.g. "Sicilian Defense: Najdorf" → "Sicilian Defense, Najdorf"). */
export function formatOpeningLabel(name: string): string {
  return name.replace(/: /g, ', ');
}

export class OpeningBook {
  private readonly root: TrieNode = { children: new Map() };

  static fromLines(lines: readonly EcoOpeningLine[]): OpeningBook {
    const book = new OpeningBook();
    for (const line of lines) {
      book.insert(line);
    }
    return book;
  }

  insert(line: EcoOpeningLine): void {
    let node = this.root;
    for (const move of line.moves) {
      const key = normalizeSan(move);
      let child = node.children.get(key);
      if (!child) {
        child = { children: new Map() };
        node.children.set(key, child);
      }
      node = child;
    }
    node.opening = { eco: line.eco, name: line.name };
  }

  /** True when the full move sequence matches a prefix of at least one ECO line. */
  isSequenceInBook(moves: readonly string[]): boolean {
    let node = this.root;
    for (const move of moves) {
      const child = node.children.get(normalizeSan(move));
      if (!child) {
        return false;
      }
      node = child;
    }
    return true;
  }

  /** Normalized SAN continuations from the current position that remain in book. */
  getBookContinuations(moves: readonly string[]): string[] {
    let node = this.root;
    for (const move of moves) {
      const child = node.children.get(normalizeSan(move));
      if (!child) {
        return [];
      }
      node = child;
    }
    return [...node.children.keys()];
  }

  /**
   * Return the deepest ECO line matching the move sequence so far.
   * Shorter parent lines (e.g. "Sicilian Defense") match before longer
   * variations (e.g. "Sicilian Defense: Najdorf Variation") as more moves arrive.
   */
  lookupOpening(moves: readonly string[]): OpeningMatch | null {
    let node = this.root;
    let bestMatch: OpeningMatch | null = null;

    for (const move of moves) {
      const child = node.children.get(normalizeSan(move));
      if (!child) {
        break;
      }
      node = child;
      if (node.opening) {
        bestMatch = node.opening;
      }
    }

    return bestMatch;
  }
}

let openingBookSingleton: OpeningBook | null = null;

export function getOpeningBook(): OpeningBook {
  if (!openingBookSingleton) {
    const data = ecoBookData as EcoBookFile;
    openingBookSingleton = OpeningBook.fromLines(data.lines);
  }
  return openingBookSingleton;
}

export function getOpeningBookMeta(): Pick<EcoBookFile, 'sourceRepository' | 'lineCount'> {
  const data = ecoBookData as EcoBookFile;
  return {
    sourceRepository: data.sourceRepository,
    lineCount: data.lineCount,
  };
}
