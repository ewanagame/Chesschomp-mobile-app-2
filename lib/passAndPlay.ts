import type { Color } from 'chess.js';

import type { BoardOrientation } from './boardOrientation';

export function boardOrientationForColor(color: Color): BoardOrientation {
  return color === 'w' ? 'white' : 'black';
}

export function passAndPlaySideLabel(color: Color): string {
  return color === 'w' ? 'White' : 'Black';
}

export function passAndPlayTurnLabel(color: Color): string {
  return color === 'w' ? 'White to move' : 'Black to move';
}
