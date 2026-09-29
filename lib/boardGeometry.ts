import type { Color, Square } from 'chess.js';

import { squareToVisualPosition, type BoardOrientation } from './boardOrientation';

/** Snap layout values to the nearest whole pixel. */
export function roundLayoutPixel(value: number): number {
  return Math.round(value);
}

/** Floor board width/height so each of the 8 ranks/files is an whole number of pixels. */
export function normalizeBoardSize(rawSize: number): number {
  const floored = Math.floor(rawSize);
  return Math.max(0, Math.floor(floored / 8) * 8);
}

export function squareSizeFromBoard(boardSize: number): number {
  return boardSize / 8;
}

export function pieceSizeFromSquare(squareSize: number): number {
  return roundLayoutPixel(squareSize * 0.92);
}

export function pieceInset(squareSize: number, pieceSize: number): number {
  return roundLayoutPixel((squareSize - pieceSize) / 2);
}

/** Top-left of a square in board coordinates (before piece inset). */
export function getSquareOrigin(
  square: Square,
  squareSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { left: number; top: number } {
  const { left, top } = squareToVisualPosition(square, squareSize, orientation, playerColor);
  return { left: roundLayoutPixel(left), top: roundLayoutPixel(top) };
}

/** Center of a square in board coordinates. */
export function getSquareCenter(
  square: Square,
  squareSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { x: number; y: number } {
  const { left, top } = getSquareOrigin(square, squareSize, orientation, playerColor);
  return {
    x: roundLayoutPixel(left + squareSize / 2),
    y: roundLayoutPixel(top + squareSize / 2),
  };
}

/** Top-left where a piece should rest — shared by board squares and move overlays. */
export function getPieceLandingPosition(
  square: Square,
  squareSize: number,
  pieceSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { left: number; top: number } {
  const { left, top } = getSquareOrigin(square, squareSize, orientation, playerColor);
  const inset = pieceInset(squareSize, pieceSize);
  return {
    left: roundLayoutPixel(left + inset),
    top: roundLayoutPixel(top + inset),
  };
}

/** Animated translate delta from one landing position to another. */
export function getPieceLandingOffset(
  from: Square,
  to: Square,
  squareSize: number,
  pieceSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { x: number; y: number } {
  const fromLanding = getPieceLandingPosition(from, squareSize, pieceSize, orientation, playerColor);
  const toLanding = getPieceLandingPosition(to, squareSize, pieceSize, orientation, playerColor);
  return {
    x: roundLayoutPixel(toLanding.left - fromLanding.left),
    y: roundLayoutPixel(toLanding.top - fromLanding.top),
  };
}

/** Center of a resting piece in board coordinates (for drag finger offset). */
export function getPieceCenterInBoard(
  square: Square,
  squareSize: number,
  pieceSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { x: number; y: number } {
  const landing = getPieceLandingPosition(square, squareSize, pieceSize, orientation, playerColor);
  return {
    x: roundLayoutPixel(landing.left + pieceSize / 2),
    y: roundLayoutPixel(landing.top + pieceSize / 2),
  };
}

/** Match visible drag overlay at drop when gesture dx/dy is unavailable. */
export function dragTranslateFromPage(
  from: Square,
  pageX: number,
  pageY: number,
  layout: { x: number; y: number },
  squareSize: number,
  pieceSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { x: number; y: number } {
  const center = getPieceCenterInBoard(from, squareSize, pieceSize, orientation, playerColor);
  return {
    x: roundLayoutPixel(pageX - layout.x - center.x),
    y: roundLayoutPixel(pageY - layout.y - center.y),
  };
}