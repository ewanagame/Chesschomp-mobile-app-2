import assert from 'node:assert/strict';
import { DEFAULT_POSITION } from 'chess.js';
import { describe, it } from 'node:test';

import {
  appendMove,
  createGameSession,
  goBack,
  goForward,
  goToIndex,
  movesThroughIndex,
  popLastMove,
  toFen,
  toPgn,
  truncateAndAppend,
} from './gameHistory';

describe('createGameSession', () => {
  it('starts empty with currentIndex -1', () => {
    const before = Date.now();
    const session = createGameSession('Finn the Clownfish');
    const after = Date.now();

    assert.deepEqual(session.moves, []);
    assert.deepEqual(session.fens, []);
    assert.equal(session.currentIndex, -1);
    assert.equal(session.opponent, 'Finn the Clownfish');
    assert.ok(session.startedAt >= before && session.startedAt <= after);
  });
});

describe('appendMove', () => {
  it('pushes SAN and FEN and points currentIndex at the new last ply', () => {
    const session = createGameSession('Opponent');
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const next = appendMove(session, 'e4', afterE4);

    assert.deepEqual(next.moves, ['e4']);
    assert.deepEqual(next.fens, [afterE4]);
    assert.equal(next.currentIndex, 0);
    assert.deepEqual(session.moves, []);
    assert.notEqual(next, session);
  });

  it('keeps appending without mutating the previous session', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const first = appendMove(createGameSession('Opponent'), 'e4', afterE4);
    const second = appendMove(first, 'e5', afterE5);

    assert.deepEqual(first.moves, ['e4']);
    assert.deepEqual(second.moves, ['e4', 'e5']);
    assert.deepEqual(second.fens, [afterE4, afterE5]);
    assert.equal(second.currentIndex, 1);
  });
});

describe('goBack', () => {
  it('decrements currentIndex and is a no-op at -1', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const session = appendMove(createGameSession('Opponent'), 'e4', afterE4);

    const back = goBack(session);
    assert.equal(back.currentIndex, -1);
    assert.deepEqual(back.moves, ['e4']);
    assert.notEqual(back, session);

    const noOp = goBack(back);
    assert.equal(noOp, back);
  });
});

describe('goForward', () => {
  it('increments currentIndex and is a no-op at the live position', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const live = appendMove(appendMove(createGameSession('Opponent'), 'e4', afterE4), 'e5', afterE5);
    const viewing = { ...live, currentIndex: 0 };

    const forward = goForward(viewing);
    assert.equal(forward.currentIndex, 1);
    assert.notEqual(forward, viewing);

    const noOp = goForward(live);
    assert.equal(noOp, live);
  });
});

describe('truncateAndAppend', () => {
  it('matches appendMove when already at the last ply', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const session = appendMove(createGameSession('Opponent'), 'e4', afterE4);

    const viaTruncate = truncateAndAppend(session, 'e5', afterE5);
    const viaAppend = appendMove(session, 'e5', afterE5);
    assert.deepEqual(viaTruncate, viaAppend);
  });

  it('discards future plies before appending when viewing history', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const afterNf3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const afterD5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const live = appendMove(
      appendMove(appendMove(createGameSession('Opponent'), 'e4', afterE4), 'e5', afterE5),
      'Nf3',
      afterNf3,
    );
    const viewingFirstPly = { ...live, currentIndex: 0 };

    const branched = truncateAndAppend(viewingFirstPly, 'd5', afterD5);
    assert.deepEqual(branched.moves, ['e4', 'd5']);
    assert.deepEqual(branched.fens, [afterE4, afterD5]);
    assert.equal(branched.currentIndex, 1);
    assert.deepEqual(live.moves, ['e4', 'e5', 'Nf3']);
  });
});

describe('goToIndex', () => {
  it('returns null when the index is unchanged', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const session = appendMove(createGameSession('Opponent'), 'e4', afterE4);
    assert.equal(goToIndex(session, 0), null);
  });

  it('returns null for out-of-range indices', () => {
    const session = createGameSession('Opponent');
    assert.equal(goToIndex(session, -2), null);
    assert.equal(goToIndex(session, 0), null);
  });
});

describe('movesThroughIndex', () => {
  it('returns no moves at the starting index', () => {
    assert.deepEqual(movesThroughIndex(createGameSession('Opponent')), []);
  });

  it('returns moves up to and including the current index', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const session = {
      ...appendMove(appendMove(createGameSession('Opponent'), 'e4', afterE4), 'e5', afterE5),
      currentIndex: 0,
    };

    assert.deepEqual(movesThroughIndex(session), ['e4']);
  });
});

describe('popLastMove', () => {
  it('removes the last ply and leaves an empty session at currentIndex -1', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const session = appendMove(createGameSession('Opponent'), 'e4', afterE4);
    const next = popLastMove(session);

    assert.deepEqual(next.moves, []);
    assert.deepEqual(next.fens, []);
    assert.equal(next.currentIndex, -1);
    assert.deepEqual(session.moves, ['e4']);
  });
});

describe('toFen', () => {
  it('returns the starting position before any moves', () => {
    assert.equal(toFen(createGameSession('Opponent')), DEFAULT_POSITION);
  });

  it('returns the FEN at currentIndex, not necessarily the latest', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const session = {
      ...appendMove(appendMove(createGameSession('Opponent'), 'e4', afterE4), 'e5', afterE5),
      currentIndex: 0,
    };

    assert.equal(toFen(session), afterE4);
  });
});

describe('toPgn', () => {
  it('builds a PGN with Player/opponent headers and paired SAN moves', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const afterNf3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    let session = createGameSession('Finn the Clownfish');
    session = appendMove(session, 'e4', afterE4);
    session = appendMove(session, 'e5', afterE5);
    session = appendMove(session, 'Nf3', afterNf3);

    const pgn = toPgn(session);
    assert.match(pgn, /\[White "Player"\]/);
    assert.match(pgn, /\[Black "Finn the Clownfish"\]/);
    assert.match(pgn, /\[Date "\d{4}\.\d{2}\.\d{2}"\]/);
    assert.match(pgn, /1\. e4 e5 2\. Nf3/);
  });
});
