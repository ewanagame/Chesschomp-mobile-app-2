import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getPieceLandingOffset,
  getPieceLandingPosition,
  normalizeBoardSize,
  pieceInset,
  pieceSizeFromSquare,
  squareSizeFromBoard,
} from './boardGeometry';

describe('boardGeometry', () => {
  it('normalizeBoardSize floors to a multiple of 8', () => {
    assert.equal(normalizeBoardSize(379), 376);
    assert.equal(normalizeBoardSize(384), 384);
    assert.equal(normalizeBoardSize(0), 0);
    assert.equal(normalizeBoardSize(7.9), 0);
  });

  it('squareSizeFromBoard is integer when board size is normalized', () => {
    const boardSize = normalizeBoardSize(391);
    const squareSize = squareSizeFromBoard(boardSize);
    assert.equal(squareSize, boardSize / 8);
    assert.equal(squareSize, Math.floor(squareSize));
  });

  it('piece landing positions are symmetric within a square', () => {
    const squareSize = 48;
    const pieceSize = pieceSizeFromSquare(squareSize);
    const inset = pieceInset(squareSize, pieceSize);
    const landing = getPieceLandingPosition('e4', squareSize, pieceSize, 'white', 'w');
    const origin = { left: 4 * squareSize, top: 4 * squareSize };

    assert.equal(landing.left, origin.left + inset);
    assert.equal(landing.top, origin.top + inset);
    assert.equal(landing.left + pieceSize + inset, origin.left + squareSize);
    assert.equal(landing.top + pieceSize + inset, origin.top + squareSize);
  });

  it('getPieceLandingOffset matches landing position delta', () => {
    const squareSize = 40;
    const pieceSize = pieceSizeFromSquare(squareSize);
    const from = getPieceLandingPosition('e2', squareSize, pieceSize, 'white', 'w');
    const to = getPieceLandingPosition('e4', squareSize, pieceSize, 'white', 'w');
    const offset = getPieceLandingOffset('e2', 'e4', squareSize, pieceSize, 'white', 'w');

    assert.equal(offset.x, to.left - from.left);
    assert.equal(offset.y, to.top - from.top);
    assert.equal(offset.y, -2 * squareSize);
    assert.equal(offset.x, 0);
  });
});
