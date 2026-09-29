import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getEloCalibration } from './botEloCalibration';
import {
  applyBotStrengthOptions,
  restoreAnalysisStrengthOptions,
  stockfishUciEloFromBotElo,
} from './stockfishStrength';

describe('stockfishStrength', () => {
  it('maps bot Elo to Stockfish UCI_Elo range', () => {
    assert.equal(stockfishUciEloFromBotElo(1000), 1320);
    assert.equal(stockfishUciEloFromBotElo(1500), 1500);
    assert.equal(stockfishUciEloFromBotElo(2000), 2000);
    assert.equal(stockfishUciEloFromBotElo(2500), 2500);
    assert.equal(stockfishUciEloFromBotElo(3200), 3190);
  });

  it('Milo 1000: UCI_Elo floor plus Skill Level softener', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(1000));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 1320')));
    assert.ok(commands.some((cmd) => cmd.includes('Skill Level value 12')));
  });

  it('Sandra 1150: UCI_Elo floor plus Skill Level softener', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(1150));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 1320')));
    assert.ok(commands.some((cmd) => cmd.includes('Skill Level value 13')));
  });

  it('Rick 1320: exact UCI_Elo, no Skill Level (1320 floor boundary)', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(1320));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 1320')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('Rex 1500: UCI_Elo only, no Skill Level', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(1500));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 1500')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('Walter 1700: exact UCI_Elo 1700, no Skill Level', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(1700));
    assert.deepEqual(commands, [
      'setoption name UCI_LimitStrength value true',
      'setoption name UCI_Elo value 1700',
    ]);
  });

  it('Nori 2000: UCI_Elo 2000 only', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(2000));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 2000')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('Marcus 2250: UCI_Elo 2250 only', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(2250));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 2250')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('Cleo 2500: UCI_Elo 2500 only', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(2500));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 2500')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('Victoria 2750: UCI_Elo 2750 only', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(2750));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 2750')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('ChessChomp 3200: full engine, LimitStrength off', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(3200));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value false')));
    assert.ok(commands.some((cmd) => cmd.includes('Skill Level value 20')));
    assert.ok(!commands.some((cmd) => cmd.includes('UCI_Elo')));
  });

  it('Peck 3000: UCI_Elo 3000, below full-engine max tier', () => {
    const commands: string[] = [];
    applyBotStrengthOptions((cmd) => commands.push(cmd), getEloCalibration(3000));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 3000')));
    assert.ok(!commands.some((cmd) => cmd.includes('Skill Level')));
  });

  it('restoreAnalysisStrengthOptions resets full strength for analysis', () => {
    const commands: string[] = [];
    restoreAnalysisStrengthOptions((cmd) => commands.push(cmd));
    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value false')));
    assert.ok(commands.some((cmd) => cmd.includes('Skill Level value 20')));
  });
});
