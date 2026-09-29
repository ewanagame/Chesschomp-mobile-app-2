import type { Color, Square } from 'chess.js';

export type BoardOrientation = 'white' | 'black';

const FILES: readonly string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function toSquare(fileIndex: number, rankIndex: number): Square {
  return `${FILES[fileIndex]}${8 - rankIndex}` as Square;
}

/** When playing as black, mirror files so the king sits to the player's right on the back rank. */
export function shouldMirrorFiles(orientation: BoardOrientation, playerColor: Color): boolean {
  return orientation === 'black' && playerColor === 'b';
}

export function realIndicesFromVisual(
  visualFileIndex: number,
  visualRankIndex: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { fileIndex: number; rankIndex: number } {
  if (orientation === 'white') {
    return { fileIndex: visualFileIndex, rankIndex: visualRankIndex };
  }

  return {
    fileIndex: shouldMirrorFiles(orientation, playerColor)
      ? 7 - visualFileIndex
      : visualFileIndex,
    rankIndex: 7 - visualRankIndex,
  };
}

export function squareToVisualPosition(
  square: Square,
  squareSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): { left: number; top: number; fileIndex: number; rankIndex: number } {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = 8 - parseInt(square[1], 10);
  const mirrorFiles = shouldMirrorFiles(orientation, playerColor);
  const visualFileIndex = mirrorFiles ? 7 - fileIndex : fileIndex;
  const visualRankIndex = orientation === 'white' ? rankIndex : 7 - rankIndex;

  return {
    fileIndex,
    rankIndex,
    left: Math.round(visualFileIndex * squareSize),
    top: Math.round(visualRankIndex * squareSize),
  };
}

export function squareFromVisualCoords(
  visualFileIndex: number,
  visualRankIndex: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): Square {
  const { fileIndex, rankIndex } = realIndicesFromVisual(
    visualFileIndex,
    visualRankIndex,
    orientation,
    playerColor,
  );
  return toSquare(fileIndex, rankIndex);
}

export function squareFromPageCoords(
  pageX: number,
  pageY: number,
  layout: { x: number; y: number; size: number },
  orientation: BoardOrientation,
  playerColor: Color = 'w',
): Square | null {
  const relX = pageX - layout.x;
  const relY = pageY - layout.y;

  if (relX < 0 || relY < 0 || relX >= layout.size || relY >= layout.size) {
    return null;
  }

  const squareSize = layout.size / 8;
  const visualFileIndex = Math.min(7, Math.floor(relX / squareSize));
  const visualRankIndex = Math.min(7, Math.floor(relY / squareSize));

  return squareFromVisualCoords(visualFileIndex, visualRankIndex, orientation, playerColor);
}

export function fileLabels(orientation: BoardOrientation): readonly string[] {
  return FILES;
}

export function rankLabels(orientation: BoardOrientation): readonly number[] {
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const;
  return orientation === 'white' ? ranks : [...ranks].reverse();
}

export function promotionPickerPosition(
  to: Square,
  squareSize: number,
  orientation: BoardOrientation,
  playerColor: Color = 'w',
  pickerScale = 1,
): { left: number; top: number } {
  const { left, top } = squareToVisualPosition(to, squareSize, orientation, playerColor);
  const rank = parseInt(to[1], 10);
  const promotionAtVisualTop =
    (orientation === 'white' && rank === 8) || (orientation === 'black' && rank === 1);
  const scaledOptionSize = squareSize * pickerScale;

  return {
    left,
    top: promotionAtVisualTop ? top : top - scaledOptionSize * 3,
  };
}
