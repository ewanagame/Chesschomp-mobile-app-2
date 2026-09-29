import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  realIndicesFromVisual,
  squareFromVisualCoords,
  squareToVisualPosition,
  toSquare,
} from './boardOrientation';

describe('board orientation mapping', () => {
  it('white orientation: a8 top-left, a1 bottom-left', () => {
    assert.equal(squareFromVisualCoords(0, 0, 'white'), 'a8');
    assert.equal(squareFromVisualCoords(0, 7, 'white'), 'a1');
    assert.equal(squareFromVisualCoords(7, 7, 'white'), 'h1');
    assert.equal(squareFromVisualCoords(7, 0, 'white'), 'h8');
  });

  it('black orientation when flipped by white player: rank flip only', () => {
    assert.equal(squareFromVisualCoords(0, 0, 'black', 'w'), 'a1');
    assert.equal(squareFromVisualCoords(0, 7, 'black', 'w'), 'a8');
    assert.equal(squareFromVisualCoords(3, 7, 'black', 'w'), 'd8');
    assert.equal(squareFromVisualCoords(4, 7, 'black', 'w'), 'e8');
  });

  it('black orientation when playing as black: rank flip and file mirror', () => {
    assert.equal(squareFromVisualCoords(0, 7, 'black', 'b'), 'h8');
    assert.equal(squareFromVisualCoords(7, 7, 'black', 'b'), 'a8');
    assert.equal(squareFromVisualCoords(3, 7, 'black', 'b'), 'e8');
    assert.equal(squareFromVisualCoords(4, 7, 'black', 'b'), 'd8');
  });

  it('squareToVisualPosition inverts realIndicesFromVisual', () => {
    for (const orientation of ['white', 'black'] as const) {
      for (const playerColor of ['w', 'b'] as const) {
        for (let visualRankIndex = 0; visualRankIndex < 8; visualRankIndex += 1) {
          for (let visualFileIndex = 0; visualFileIndex < 8; visualFileIndex += 1) {
            const square = squareFromVisualCoords(
              visualFileIndex,
              visualRankIndex,
              orientation,
              playerColor,
            );
            const { fileIndex, rankIndex } = realIndicesFromVisual(
              visualFileIndex,
              visualRankIndex,
              orientation,
              playerColor,
            );
            assert.equal(square, toSquare(fileIndex, rankIndex));

            const visual = squareToVisualPosition(square, 40, orientation, playerColor);
            assert.equal(visual.left, visualFileIndex * 40);
            assert.equal(visual.top, visualRankIndex * 40);
          }
        }
      }
    }
  });
});
