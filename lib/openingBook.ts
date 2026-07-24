import ecoBookData from '../assets/openings/eco-book.json';

export type EcoOpeningLine = {
  eco: string;
  name: string;
  moves: string[];
};

type EcoBookFile = {
  sourceRepository: string;
  lineCount: number;
  lines: EcoOpeningLine[];
};

type TrieNode = {
  children: Map<string, TrieNode>;
};

function normalizeSan(san: string): string {
  return san.replace(/[+#!?]+$/g, '');
}

export class OpeningBook {
  private readonly root: TrieNode = { children: new Map() };

  static fromLines(lines: readonly EcoOpeningLine[]): OpeningBook {
    const book = new OpeningBook();
    for (const line of lines) {
      book.insert(line.moves);
    }
    return book;
  }

  insert(moves: readonly string[]): void {
    let node = this.root;
    for (const move of moves) {
      const key = normalizeSan(move);
      let child = node.children.get(key);
      if (!child) {
        child = { children: new Map() };
        node.children.set(key, child);
      }
      node = child;
    }
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
