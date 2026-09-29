import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';

import { classifyPly } from './classifyPly';
import { movetimeSearch, type MultiPvAnalysis, type PositionAnalysis } from './stockfishAnalysis';

const SEARCH = movetimeSearch(300);

function analysis(
  fen: string,
  evalCentipawns: number,
  bestMoveUci: string,
  scoreMate: number | null = null,
): PositionAnalysis {
  const sideToMove = fen.split(/\s+/)[1] === 'b' ? 'b' : 'w';
  return {
    fen,
    sideToMove,
    evalCentipawns,
    bestMoveUci,
    scoreCp: scoreMate == null ? evalCentipawns : null,
    scoreMate,
  };
}

describe('classifyPly', () => {
  it('only runs a MultiPV before-search and one after-search', async () => {
    const chess = new Chess();
    const move = chess.move('e4');
    assert.ok(move);

    let analysisCalls = 0;
    let multiPvCalls = 0;

    const beforeFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = await classifyPly(
      {
        runAnalysis: async (fen) => {
          analysisCalls += 1;
          return analysis(fen, 25, 'e7e5');
        },
        runMultiPvAnalysis: async (fen) => {
          multiPvCalls += 1;
          const line: MultiPvAnalysis = {
            fen,
            sideToMove: 'w',
            lines: [
              { multipv: 1, evalCentipawns: 20, pv: ['d2d4'], scoreCp: 20, scoreMate: null },
              { multipv: 2, evalCentipawns: 18, pv: ['e2e4'], scoreCp: 18, scoreMate: null },
            ],
          };
          return line;
        },
      },
      {
        move,
        fenBefore: beforeFen,
        search: SEARCH,
        gameSanMovesBefore: [],
        hasLeftBook: true,
      },
    );

    assert.equal(multiPvCalls, 1);
    assert.equal(analysisCalls, 1);
    assert.equal(result.record.wasBestMove, false);
    assert.equal(result.record.move, 'e2e4');
    assert.equal(result.afterAnalysis.fen, move.after);
  });

  it('rates a mating underpromotion Brilliant when the engine preferred the queen', async () => {
    const chess = new Chess('4k3/6P1/8/8/8/8/4P3/4K3 w - - 0 1');
    const fenBefore = chess.fen();
    const move = chess.move('g8=N');
    assert.ok(move);

    const result = await classifyPly(
      {
        runAnalysis: async (fen) => analysis(fen, -99_000, '', -1),
        runMultiPvAnalysis: async (fen) => ({
          fen,
          sideToMove: 'w' as const,
          lines: [
            { multipv: 1, evalCentipawns: 99_000, pv: ['g7g8q'], scoreCp: null, scoreMate: 1 },
            { multipv: 2, evalCentipawns: 99_000, pv: ['g7g8n'], scoreCp: null, scoreMate: 1 },
          ],
        }),
      },
      {
        move,
        fenBefore,
        search: SEARCH,
        gameSanMovesBefore: [],
        hasLeftBook: true,
      },
    );

    assert.equal(result.record.wasBestMove, true);
    assert.equal(result.record.classification, 'Brilliant');
    assert.equal(result.record.san, 'g8=N');
  });
});
