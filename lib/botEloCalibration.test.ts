import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getEloCalibration,
  botMoveUsesStockfish,
  MATERIAL_EVAL_ELO_THRESHOLD,
} from './botEloCalibration';

describe('losing bot behavior', () => {
  it('uses Stockfish for Finn and other losing bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 100, behavior: 'losing' }),
      true,
    );
  });

  it('does not use Stockfish for standard 100 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 100, behavior: 'standard' }),
      false,
    );
  });
});

describe('getEloCalibration(900)', () => {
  const calibration = getEloCalibration(900);
  const doug = getEloCalibration(750);
  const milo = getEloCalibration(1000);

  it('uses Stockfish eval (at 900 threshold boundary)', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
    assert.equal(getEloCalibration(899).useMaterialOnlyEval, true);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 900,
      searchDepth: 3,
      bestMoveProbability: 0.817,
      blunderSeverity: 0.727,
      evalNoise: 87,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 12,
      stockfishMovetimeMs: 748,
      stockfishSearchDepth: 14,
    });
  });

  it('is stronger than Doug (750) and weaker than Milo (1000)', () => {
    assert.ok(calibration.bestMoveProbability > doug.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < milo.bestMoveProbability);
    assert.ok(calibration.evalNoise < doug.evalNoise);
    assert.ok(calibration.evalNoise > milo.evalNoise);
  });

  it('uses Stockfish for standard 900 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 900, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(1700)', () => {
  const calibration = getEloCalibration(1700);
  const rex = getEloCalibration(1500);
  const scout = getEloCalibration(2000);

  it('uses Stockfish eval', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 1700,
      searchDepth: 3,
      bestMoveProbability: 0.905,
      blunderSeverity: 0.868,
      evalNoise: 44,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 16,
      stockfishMovetimeMs: 876,
      stockfishSearchDepth: 16,
    });
  });

  it('is stronger than Rex (1500) and weaker than Scout (2000)', () => {
    assert.ok(calibration.bestMoveProbability > rex.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < scout.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth >= rex.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth <= scout.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < rex.evalNoise);
    assert.ok(calibration.evalNoise > scout.evalNoise);
  });

  it('uses Stockfish for standard 1700 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 1700, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(1150)', () => {
  const calibration = getEloCalibration(1150);
  const milo = getEloCalibration(1000);
  const rick = getEloCalibration(1320);

  it('uses Stockfish eval', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 1150,
      searchDepth: 3,
      bestMoveProbability: 0.851,
      blunderSeverity: 0.783,
      evalNoise: 70,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 13,
      stockfishMovetimeMs: 797,
      stockfishSearchDepth: 15,
    });
  });

  it('is stronger than Milo (1000) and weaker than Rick (1320)', () => {
    assert.ok(calibration.bestMoveProbability > milo.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < rick.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth >= milo.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth <= rick.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < milo.evalNoise);
    assert.ok(calibration.evalNoise > rick.evalNoise);
  });

  it('uses Stockfish for standard 1150 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 1150, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(1320)', () => {
  const calibration = getEloCalibration(1320);
  const milo = getEloCalibration(1000);
  const rex = getEloCalibration(1500);

  it('uses Stockfish eval', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 1320,
      searchDepth: 3,
      bestMoveProbability: 0.87,
      blunderSeverity: 0.813,
      evalNoise: 61,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 14,
      stockfishMovetimeMs: 825,
      stockfishSearchDepth: 15,
    });
  });

  it('is stronger than Milo (1000) and weaker than Rex (1500)', () => {
    assert.ok(calibration.bestMoveProbability > milo.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < rex.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth >= milo.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth <= rex.stockfishSearchDepth);
  });

  it('uses Stockfish for standard 1320 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 1320, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(750)', () => {
  const calibration = getEloCalibration(750);
  const buddy = getEloCalibration(600);
  const milo = getEloCalibration(1000);

  it('uses material-only eval (under 900 threshold)', () => {
    assert.equal(calibration.useMaterialOnlyEval, true);
    assert.equal(MATERIAL_EVAL_ELO_THRESHOLD, 900);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 750,
      searchDepth: 3,
      bestMoveProbability: 0.791,
      blunderSeverity: 0.684,
      evalNoise: 99,
      useMaterialOnlyEval: true,
      stockfishSkillLevel: 11,
      stockfishMovetimeMs: 710,
      stockfishSearchDepth: 13,
    });
  });

  it('is stronger than the 600 tier and weaker than the 1000 tier', () => {
    assert.ok(calibration.bestMoveProbability > buddy.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < milo.bestMoveProbability);
    assert.ok(calibration.evalNoise < buddy.evalNoise);
    assert.ok(calibration.evalNoise > milo.evalNoise);
    assert.ok(calibration.stockfishSearchDepth > buddy.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth < milo.stockfishSearchDepth);
  });

  it('uses material search for standard 750 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 750, behavior: 'standard' }),
      false,
    );
  });
});

describe('getEloCalibration(350)', () => {
  const calibration = getEloCalibration(350);
  const kevin = getEloCalibration(250);
  const dave = getEloCalibration(450);

  it('uses material-only eval (under 900 threshold)', () => {
    assert.equal(calibration.useMaterialOnlyEval, true);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 350,
      searchDepth: 2,
      bestMoveProbability: 0.677,
      blunderSeverity: 0.491,
      evalNoise: 148,
      useMaterialOnlyEval: true,
      stockfishSkillLevel: 6,
      stockfishMovetimeMs: 550,
      stockfishSearchDepth: 11,
    });
  });

  it('is stronger than Kevin (250) and weaker than Dave (450)', () => {
    assert.ok(calibration.bestMoveProbability > kevin.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < dave.bestMoveProbability);
    assert.ok(calibration.evalNoise < kevin.evalNoise);
    assert.ok(calibration.evalNoise > dave.evalNoise);
  });

  it('uses material search for standard 350 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 350, behavior: 'standard' }),
      false,
    );
  });
});

describe('getEloCalibration(450)', () => {
  const calibration = getEloCalibration(450);
  const kevin = getEloCalibration(250);
  const buddy = getEloCalibration(600);

  it('uses material-only eval (under 900 threshold)', () => {
    assert.equal(calibration.useMaterialOnlyEval, true);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 450,
      searchDepth: 2,
      bestMoveProbability: 0.716,
      blunderSeverity: 0.557,
      evalNoise: 132,
      useMaterialOnlyEval: true,
      stockfishSkillLevel: 8,
      stockfishMovetimeMs: 604,
      stockfishSearchDepth: 11,
    });
  });

  it('is stronger than the 250 tier and weaker than the 600 tier', () => {
    assert.ok(calibration.bestMoveProbability > kevin.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < buddy.bestMoveProbability);
    assert.ok(calibration.evalNoise < kevin.evalNoise);
    assert.ok(calibration.evalNoise > buddy.evalNoise);
    assert.ok(calibration.stockfishSearchDepth > kevin.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth < buddy.stockfishSearchDepth);
  });

  it('uses material search for standard 450 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 450, behavior: 'standard' }),
      false,
    );
  });
});

describe('getEloCalibration(250)', () => {
  const calibration = getEloCalibration(250);
  const chip = getEloCalibration(200);

  it('uses material-only eval (under 900 threshold)', () => {
    assert.equal(calibration.useMaterialOnlyEval, true);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 250,
      searchDepth: 2,
      bestMoveProbability: 0.624,
      blunderSeverity: 0.394,
      evalNoise: 169,
      useMaterialOnlyEval: true,
      stockfishSkillLevel: 4,
      stockfishMovetimeMs: 477,
      stockfishSearchDepth: 9,
    });
  });

  it('is slightly stronger than the 200 tier', () => {
    assert.ok(calibration.bestMoveProbability > chip.bestMoveProbability);
    assert.ok(calibration.evalNoise < chip.evalNoise);
    assert.ok(calibration.blunderSeverity > chip.blunderSeverity);
  });

  it('uses material search for standard 250 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 250, behavior: 'standard' }),
      false,
    );
  });
});

describe('getEloCalibration(1000)', () => {
  const calibration = getEloCalibration(1000);

  it('crosses the material-only threshold', () => {
    assert.equal(MATERIAL_EVAL_ELO_THRESHOLD, 900);
    assert.equal(calibration.useMaterialOnlyEval, false);
    assert.equal(getEloCalibration(899).useMaterialOnlyEval, true);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 1000,
      searchDepth: 3,
      bestMoveProbability: 0.831,
      blunderSeverity: 0.751,
      evalNoise: 80,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 12,
      stockfishMovetimeMs: 769,
      stockfishSearchDepth: 14,
    });
  });

  it('uses Stockfish for standard 1000 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 1000, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(1500)', () => {
  const calibration = getEloCalibration(1500);
  const milo = getEloCalibration(1000);

  it('uses Stockfish eval (past material-only threshold)', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 1500,
      searchDepth: 3,
      bestMoveProbability: 0.888,
      blunderSeverity: 0.841,
      evalNoise: 52,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 15,
      stockfishMovetimeMs: 851,
      stockfishSearchDepth: 15,
    });
  });

  it('is meaningfully stronger than the 1000 tier on Stockfish knobs', () => {
    assert.ok(calibration.bestMoveProbability > milo.bestMoveProbability);
    assert.ok(calibration.stockfishSkillLevel > milo.stockfishSkillLevel);
    assert.ok(calibration.stockfishMovetimeMs > milo.stockfishMovetimeMs);
    assert.ok(calibration.stockfishSearchDepth > milo.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < milo.evalNoise);
    assert.ok(calibration.blunderSeverity > milo.blunderSeverity);
  });

  it('uses Stockfish for standard 1500 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 1500, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(2000)', () => {
  const calibration = getEloCalibration(2000);
  const rex = getEloCalibration(1500);

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 2000,
      searchDepth: 4,
      bestMoveProbability: 0.927,
      blunderSeverity: 0.903,
      evalNoise: 33,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 17,
      stockfishMovetimeMs: 908,
      stockfishSearchDepth: 16,
    });
  });

  it('is stronger than the 1500 tier', () => {
    assert.ok(calibration.bestMoveProbability > rex.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth > rex.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < rex.evalNoise);
  });
});

describe('getEloCalibration(2250)', () => {
  const calibration = getEloCalibration(2250);
  const scout = getEloCalibration(2000);
  const cleo = getEloCalibration(2500);

  it('uses Stockfish eval', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 2250,
      searchDepth: 4,
      bestMoveProbability: 0.943,
      blunderSeverity: 0.928,
      evalNoise: 24,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 18,
      stockfishMovetimeMs: 931,
      stockfishSearchDepth: 17,
    });
  });

  it('is stronger than Scout (2000) and weaker than Cleo (2500)', () => {
    assert.ok(calibration.bestMoveProbability > scout.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < cleo.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth >= scout.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth <= cleo.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < scout.evalNoise);
    assert.ok(calibration.evalNoise > cleo.evalNoise);
  });

  it('uses Stockfish for standard 2250 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 2250, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(2500)', () => {
  const calibration = getEloCalibration(2500);
  const scout = getEloCalibration(2000);

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 2500,
      searchDepth: 4,
      bestMoveProbability: 0.957,
      blunderSeverity: 0.95,
      evalNoise: 17,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 18,
      stockfishMovetimeMs: 952,
      stockfishSearchDepth: 17,
    });
  });

  it('is stronger than the 2000 tier', () => {
    assert.ok(calibration.bestMoveProbability > scout.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth > scout.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < scout.evalNoise);
  });
});

describe('getEloCalibration(2750)', () => {
  const calibration = getEloCalibration(2750);
  const remy = getEloCalibration(2250);
  const maxTier = getEloCalibration(3200);

  it('uses Stockfish eval', () => {
    assert.equal(calibration.useMaterialOnlyEval, false);
  });

  it('returns expected interpolated curve values', () => {
    assert.deepEqual(calibration, {
      elo: 2750,
      searchDepth: 4,
      bestMoveProbability: 0.97,
      blunderSeverity: 0.969,
      evalNoise: 11,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 19,
      stockfishMovetimeMs: 970,
      stockfishSearchDepth: 18,
    });
  });

  it('is stronger than Remy (2250) and weaker than max tier (3200)', () => {
    assert.ok(calibration.bestMoveProbability > remy.bestMoveProbability);
    assert.ok(calibration.bestMoveProbability < maxTier.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth >= remy.stockfishSearchDepth);
    assert.ok(calibration.stockfishSearchDepth <= maxTier.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < remy.evalNoise);
    assert.ok(calibration.evalNoise > maxTier.evalNoise);
  });

  it('uses Stockfish for standard 2750 Elo bots', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 2750, behavior: 'standard' }),
      true,
    );
  });
});

describe('getEloCalibration(3200)', () => {
  const calibration = getEloCalibration(3200);
  const echo = getEloCalibration(2750);

  it('returns expected max-tier curve values', () => {
    assert.deepEqual(calibration, {
      elo: 3200,
      searchDepth: 4,
      bestMoveProbability: 0.99,
      blunderSeverity: 1,
      evalNoise: 0,
      useMaterialOnlyEval: false,
      stockfishSkillLevel: 20,
      stockfishMovetimeMs: 1000,
      stockfishSearchDepth: 18,
    });
  });

  it('is stronger than Echo (2750)', () => {
    assert.ok(calibration.bestMoveProbability > echo.bestMoveProbability);
    assert.ok(calibration.stockfishSearchDepth >= echo.stockfishSearchDepth);
    assert.ok(calibration.evalNoise < echo.evalNoise);
  });

  it('uses Stockfish for max-tier standard bots (e.g. Peck, ChessChomp)', () => {
    assert.equal(
      botMoveUsesStockfish({ elo: 3200, behavior: 'standard' }),
      true,
    );
  });
});
