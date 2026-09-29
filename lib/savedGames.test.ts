import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_SAVED_GAME_NAME_LENGTH,
  normalizeSavedGameName,
} from './savedGameName';
import {
  defaultSavedGameName,
  parseSavedGame,
  parseSavedGamesFile,
  removeSavedGameById,
  type SavedGame,
} from './savedGamesParse';

const SAMPLE_GAME: SavedGame = {
  id: 'game-1',
  name: 'vs Chomp - Sep 19',
  pgn: '[Event "Test"]\n\n1. e4 e5 2. Nf3 *',
  moves: ['e4', 'e5', 'Nf3'],
  fens: [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
  ],
  mode: 'bot',
  botId: 'chomp',
  playerColor: 'w',
  result: 'White wins',
  savedAt: 1_700_000_000_000,
};

describe('parseSavedGame', () => {
  it('accepts a valid saved game', () => {
    const parsed = parseSavedGame(SAMPLE_GAME);
    assert.deepEqual(parsed, SAMPLE_GAME);
  });

  it('rejects games without moves', () => {
    assert.equal(parseSavedGame({ ...SAMPLE_GAME, moves: [] }), null);
  });

  it('rejects bot games without botId', () => {
    assert.equal(parseSavedGame({ ...SAMPLE_GAME, botId: undefined }), null);
  });

  it('keeps the game when a stored evaluation has non-finite evals', () => {
    const raw = JSON.parse(
      JSON.stringify({
        ...SAMPLE_GAME,
        review: {
          depth: 18,
          analyzedAt: 1,
          analysisVersion: 2,
          classifiedMoves: [
            {
              move: 'e2e4',
              san: 'e4',
              color: 'w',
              classification: 'Best',
              evalBefore: Number.POSITIVE_INFINITY,
              evalAfter: Number.NaN,
              wasBestMove: true,
              fenBefore: 'startpos',
              fenAfter: 'after-e4',
            },
          ],
        },
      }),
    ) as SavedGame;

    const parsed = parseSavedGame(raw);
    assert.equal(parsed?.id, SAMPLE_GAME.id);
    assert.equal(parsed?.review?.classifiedMoves[0]?.evalBefore, 0);
    assert.equal(parsed?.review?.classifiedMoves[0]?.evalAfter, 0);
  });

  it('accepts cached review data', () => {
    const withReview = {
      ...SAMPLE_GAME,
      review: {
        depth: 18,
        analyzedAt: 1_700_000_100_000,
        classifiedMoves: [
          {
            move: 'e2e4',
            san: 'e4',
            color: 'w' as const,
            classification: 'Best' as const,
            evalBefore: 20,
            evalAfter: 25,
            wasBestMove: true,
            fenBefore: 'startpos',
            fenAfter: 'after-e4',
          },
        ],
      },
    };
    assert.ok(parseSavedGame(withReview));
  });
});

describe('parseSavedGamesFile', () => {
  it('returns sorted games from a file payload', () => {
    const older = { ...SAMPLE_GAME, id: 'older', savedAt: 1 };
    const newer = { ...SAMPLE_GAME, id: 'newer', savedAt: 2 };
    const parsed = parseSavedGamesFile({ games: [older, newer] });
    assert.deepEqual(parsed.map((game) => game.id), ['newer', 'older']);
  });

  it('returns an empty list for invalid payloads', () => {
    assert.deepEqual(parseSavedGamesFile(null), []);
    assert.deepEqual(parseSavedGamesFile({ games: 'nope' }), []);
  });
});

describe('normalizeSavedGameName', () => {
  it('trims and caps names at the max length', () => {
    const longName = 'a'.repeat(100);
    const normalized = normalizeSavedGameName(`  ${longName}  `);
    assert.equal(normalized?.length, MAX_SAVED_GAME_NAME_LENGTH);
    assert.equal(normalized, 'a'.repeat(MAX_SAVED_GAME_NAME_LENGTH));
  });

  it('rejects empty names', () => {
    assert.equal(normalizeSavedGameName('   '), null);
  });
});

describe('parseSavedGame name limits', () => {
  it('truncates oversized stored names on load', () => {
    const longName = 'x'.repeat(100);
    const parsed = parseSavedGame({ ...SAMPLE_GAME, name: longName });
    assert.equal(parsed?.name.length, MAX_SAVED_GAME_NAME_LENGTH);
    assert.equal(parsed?.name, 'x'.repeat(MAX_SAVED_GAME_NAME_LENGTH));
  });
});

describe('removeSavedGameById', () => {
  it('removes that game and its nested evaluation from storage payload', () => {
    const keep = { ...SAMPLE_GAME, id: 'keep' };
    const remove: SavedGame = {
      ...SAMPLE_GAME,
      id: 'remove',
      review: {
        depth: 18,
        analyzedAt: 1,
        classifiedMoves: [
          {
            move: 'e2e4',
            san: 'e4',
            color: 'w',
            classification: 'Best',
            evalBefore: 20,
            evalAfter: 25,
            wasBestMove: true,
            fenBefore: 'startpos',
            fenAfter: 'after-e4',
          },
        ],
      },
    };

    const before = JSON.stringify({ games: [keep, remove] });
    const next = removeSavedGameById([keep, remove], 'remove');
    assert.ok(next);
    assert.deepEqual(next.map((game) => game.id), ['keep']);
    assert.equal(next[0]?.review, undefined);

    const after = JSON.stringify({ games: next });
    assert.equal(after.includes('"remove"'), false);
    assert.equal(after.includes('"classifiedMoves"'), false);
    assert.ok(after.length < before.length);
  });

  it('returns null when the id is not stored', () => {
    assert.equal(removeSavedGameById([SAMPLE_GAME], 'missing'), null);
  });
});

describe('defaultSavedGameName', () => {
  it('includes the bot name for bot games', () => {
    const name = defaultSavedGameName({
      mode: 'bot',
      botName: 'Chomp',
      savedAt: Date.UTC(2026, 8, 19),
    });
    assert.match(name, /vs Chomp/);
  });

  it('uses a free board label for solo games', () => {
    const name = defaultSavedGameName({ mode: 'free' });
    assert.match(name, /Free Board/);
  });
});
