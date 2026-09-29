import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describe, it } from 'node:test';

import {
  BOARD_SIDE_AVATAR_GAP,
  BOARD_SIDE_AVATAR_SIZE,
  capturedPiecesBarWidth,
  computeCapturedMaterial,
  computeCapturedMaterialFromMoves,
  computeCapturedMaterialFromSans,
  expandCapturedPieceIcons,
  visualBottomColor,
  visualTopColor,
} from './capturedPieces';

describe('computeCapturedMaterialFromMoves', () => {
  it('aggregates captures by captor and computes advantage', () => {
    const game = new Chess();
    game.move('e4');
    game.move('d5');
    game.move('exd5');
    const moves = game.history({ verbose: true });

    const material = computeCapturedMaterialFromMoves(moves);

    assert.equal(material.white.counts.p, 1);
    assert.equal(material.white.materialValue, 1);
    assert.equal(material.black.materialValue, 0);
    assert.deepEqual(material.advantage, { side: 'w', points: 1 });
  });

  it('recomputes correctly after undo', () => {
    const game = new Chess();
    game.move('e4');
    game.move('d5');
    game.move('exd5');
    game.undo();

    const material = computeCapturedMaterial(game);

    assert.equal(material.white.materialValue, 0);
    assert.equal(material.black.materialValue, 0);
    assert.equal(material.advantage, null);
  });
});

describe('computeCapturedMaterialFromSans', () => {
  it('replays SAN and counts captures even when the live board has no history', () => {
    const sans = ['e4', 'd5', 'exd5'];
    const fenOnly = new Chess();
    for (const san of sans) {
      fenOnly.move(san);
    }
    const restored = new Chess(fenOnly.fen());

    assert.equal(restored.history().length, 0);
    assert.equal(computeCapturedMaterial(restored).white.materialValue, 0);

    const material = computeCapturedMaterialFromSans(sans);
    assert.equal(material.white.counts.p, 1);
    assert.equal(material.white.materialValue, 1);
    assert.deepEqual(material.advantage, { side: 'w', points: 1 });
  });

  it('only includes captures through the viewed prefix', () => {
    const sans = ['e4', 'd5', 'exd5', 'Qxd5'];
    const throughWhiteCapture = computeCapturedMaterialFromSans(sans.slice(0, 3));
    const throughBlackRecapture = computeCapturedMaterialFromSans(sans);

    assert.equal(throughWhiteCapture.white.counts.p, 1);
    assert.equal(throughWhiteCapture.black.materialValue, 0);
    assert.equal(throughBlackRecapture.black.counts.p, 1);
    assert.equal(throughBlackRecapture.advantage, null);
  });

  it('returns empty material for no moves', () => {
    const material = computeCapturedMaterialFromSans([]);
    assert.equal(material.white.materialValue, 0);
    assert.equal(material.black.materialValue, 0);
    assert.equal(material.advantage, null);
  });
});

describe('expandCapturedPieceIcons', () => {
  it('expands counts into individual icons in display order', () => {
    assert.deepEqual(expandCapturedPieceIcons({ q: 1, p: 3, n: 1 }), [
      'p',
      'p',
      'p',
      'n',
      'q',
    ]);
  });
});

describe('capturedPiecesBarWidth', () => {
  it('cuts the bar to leave room for the side portrait', () => {
    assert.equal(
      capturedPiecesBarWidth(320),
      320 - BOARD_SIDE_AVATAR_SIZE - BOARD_SIDE_AVATAR_GAP,
    );
  });
});

describe('board orientation helpers', () => {
  it('maps visual top/bottom to sides', () => {
    assert.equal(visualTopColor('white'), 'b');
    assert.equal(visualBottomColor('white'), 'w');
    assert.equal(visualTopColor('black'), 'w');
    assert.equal(visualBottomColor('black'), 'b');
  });
});
