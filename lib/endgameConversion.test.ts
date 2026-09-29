import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getEloCalibration } from './botEloCalibration';
import {
  ENDGAME_CONVERSION_MAX_SEARCH_DEPTH,
  endgameConversionBlend,
  getEndgameConversionCalibration,
  isTrivialWinningEndgame,
} from './endgameConversion';
import { applyBotStrengthOptions } from './stockfishStrength';

/** White (bot) to move: K+Q vs K — trivial winning endgame. */
const KQ_VS_K_WHITE =
  '8/8/8/8/8/4k3/8/Q6K w - - 0 1';

/** White (bot) to move: K+R vs K. */
const KR_VS_K_WHITE =
  '8/8/8/8/8/4k3/8/4R2K w - - 0 1';

/** White has Q+R vs lone K — excluded (real technical fight). */
const KQR_VS_KR_WHITE =
  '8/8/8/8/8/4k3/4r3/Q6K w - - 0 1';

/** Five non-king pieces — above the trivial-endgame piece cap. */
const TOO_MANY_PIECES =
  '8/4p3/4p3/4p3/4k3/4p3/8/Q6K w - - 0 1';

describe('isTrivialWinningEndgame', () => {
  it('accepts K+Q vs K when bot is to move', () => {
    assert.equal(isTrivialWinningEndgame(KQ_VS_K_WHITE, 'w'), true);
  });

  it('accepts K+R vs K when bot is to move', () => {
    assert.equal(isTrivialWinningEndgame(KR_VS_K_WHITE, 'w'), true);
  });

  it('rejects K+Q vs K+R (opponent still has major piece)', () => {
    assert.equal(isTrivialWinningEndgame(KQR_VS_KR_WHITE, 'w'), false);
  });

  it('rejects when it is not the bot turn', () => {
    assert.equal(isTrivialWinningEndgame(KQ_VS_K_WHITE, 'b'), false);
  });

  it('rejects when too many non-king pieces remain', () => {
    assert.equal(isTrivialWinningEndgame(TOO_MANY_PIECES, 'w'), false);
  });
});

describe('endgameConversionBlend', () => {
  it('returns 0 at minimum Elo and 1 at maximum Elo', () => {
    assert.equal(endgameConversionBlend(100), 0);
    assert.equal(endgameConversionBlend(3200), 1);
  });

  it('increases monotonically with Elo', () => {
    assert.ok(endgameConversionBlend(1000) < endgameConversionBlend(1700));
    assert.ok(endgameConversionBlend(1700) < endgameConversionBlend(2500));
  });
});

describe('getEndgameConversionCalibration', () => {
  it('is inactive for material-only bots', () => {
    const base = getEloCalibration(750);
    const result = getEndgameConversionCalibration(KQ_VS_K_WHITE, 'w', base);
    assert.equal(result.active, false);
    assert.deepEqual(result.calibration, base);
    assert.equal(result.strengthOverrides, undefined);
  });

  it('is inactive outside trivial winning endgames', () => {
    const base = getEloCalibration(1700);
    const result = getEndgameConversionCalibration(KQR_VS_KR_WHITE, 'w', base);
    assert.equal(result.active, false);
  });

  it('Milo 1000: lerps UCI, depth, evalNoise, and move knobs toward conversion targets', () => {
    const base = getEloCalibration(1000);
    const result = getEndgameConversionCalibration(KQ_VS_K_WHITE, 'w', base);

    assert.equal(result.active, true);
    assert.ok(result.effectiveBlend > 0.7 && result.effectiveBlend < 0.72);
    assert.ok(result.calibration.bestMoveProbability > 0.949);
    assert.ok(result.calibration.bestMoveProbability < 0.952);
    assert.ok(result.calibration.evalNoise < base.evalNoise);
    assert.ok(result.calibration.stockfishSearchDepth >= 16);
    assert.equal(result.strengthOverrides?.uciElo, 2641);
    assert.ok(result.strengthOverrides?.skillLevel !== undefined);

    const commands: string[] = [];
    applyBotStrengthOptions(
      (cmd) => commands.push(cmd),
      result.calibration,
      result.strengthOverrides,
    );
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 2641')));
    assert.ok(commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('Walter 1700: stronger conversion blend than Milo 1000', () => {
    const milo = getEndgameConversionCalibration(
      KQ_VS_K_WHITE,
      'w',
      getEloCalibration(1000),
    );
    const walter = getEndgameConversionCalibration(
      KQ_VS_K_WHITE,
      'w',
      getEloCalibration(1700),
    );

    assert.ok(walter.effectiveBlend > milo.effectiveBlend);
    assert.ok(walter.calibration.bestMoveProbability > milo.calibration.bestMoveProbability);
    assert.ok(walter.calibration.evalNoise < milo.calibration.evalNoise);
    assert.ok(walter.strengthOverrides!.uciElo! > milo.strengthOverrides!.uciElo!);
    assert.equal(walter.strengthOverrides?.uciElo, 2955);
    assert.equal(walter.calibration.stockfishSearchDepth, ENDGAME_CONVERSION_MAX_SEARCH_DEPTH);
    assert.equal(walter.strengthOverrides?.skillLevel, undefined);
  });

  it('ChessChomp 3200: no UCI override (full engine path), knobs at conversion max', () => {
    const base = getEloCalibration(3200);
    const result = getEndgameConversionCalibration(KQ_VS_K_WHITE, 'w', base);

    assert.equal(result.active, true);
    assert.equal(result.effectiveBlend, 1);
    assert.equal(result.calibration.bestMoveProbability, 1);
    assert.equal(result.calibration.evalNoise, 0);
    assert.equal(result.calibration.stockfishSearchDepth, ENDGAME_CONVERSION_MAX_SEARCH_DEPTH);
    assert.equal(result.strengthOverrides, undefined);

    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), result.calibration);
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value false')));
    assert.ok(!commands.some((cmd) => cmd.includes('UCI_Elo')));
  });
});
