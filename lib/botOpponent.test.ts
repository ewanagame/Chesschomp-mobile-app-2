import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runCalibratedBotSearch } from './botOpponent';
import { getEloCalibration } from './botEloCalibration';
import type { RegisterAnalysisCancel } from './stockfishCancel';

function createMockStockfish(responses: string[]) {
  const listeners = new Set<(line: string) => void>();

  const sendCommand = (command: string) => {
    if (!command.startsWith('go ')) {
      return;
    }

    setTimeout(() => {
      for (const line of responses) {
        for (const listener of listeners) {
          listener(line);
        }
      }
    }, 0);
  };

  const addLineListener = (listener: (line: string) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const registerAnalysisCancel: RegisterAnalysisCancel = () => () => undefined;

  return { sendCommand, addLineListener, registerAnalysisCancel };
}

describe('runCalibratedBotSearch material path (750 Elo)', () => {
  it('returns a legal move without Stockfish', async () => {
    const calibration = { ...getEloCalibration(750), bestMoveProbability: 1 };
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      () => undefined,
      () => () => undefined,
      () => () => undefined,
    );

    assert.ok(move);
    assert.ok(move.from.length === 2);
    assert.ok(move.to.length === 2);
  });
});

describe('runCalibratedBotSearch material path (450 Elo)', () => {
  it('returns a legal move without Stockfish', async () => {
    const calibration = { ...getEloCalibration(450), bestMoveProbability: 1 };
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      () => undefined,
      () => () => undefined,
      () => () => undefined,
    );

    assert.ok(move);
    assert.ok(move.from.length === 2);
    assert.ok(move.to.length === 2);
  });
});

describe('runCalibratedBotSearch material path (250 Elo)', () => {
  it('returns a legal move without Stockfish', async () => {
    const calibration = { ...getEloCalibration(250), bestMoveProbability: 1 };
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      () => undefined,
      () => () => undefined,
      () => () => undefined,
    );

    assert.ok(move);
    assert.ok(move.from.length === 2);
    assert.ok(move.to.length === 2);
  });
});

describe('runCalibratedBotSearch Stockfish path (1000 Elo)', () => {
  it('returns a legal move from MultiPV search without throwing', async () => {
    const calibration = { ...getEloCalibration(1000), bestMoveProbability: 1 };
    assert.equal(calibration.useMaterialOnlyEval, false);
    assert.equal(calibration.stockfishSkillLevel, 12);
    assert.notEqual(calibration.stockfishSkillLevel, 20);

    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const { sendCommand, addLineListener, registerAnalysisCancel } = createMockStockfish([
      'info depth 14 multipv 1 score cp 35 pv e2e4',
      'info depth 14 multipv 2 score cp 20 pv d2d4',
      'bestmove e2e4',
    ]);

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
    );

    assert.ok(move);
    assert.equal(move.from, 'e2');
    assert.equal(move.to, 'e4');
  });

  it('prefers skill-limited bestmove over stronger MultiPV line 1', async () => {
    const calibration = { ...getEloCalibration(1000), bestMoveProbability: 1 };
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const commands: string[] = [];

    const listeners = new Set<(line: string) => void>();
    const sendCommand = (command: string) => {
      commands.push(command);
      if (!command.startsWith('go ')) {
        return;
      }
      setTimeout(() => {
        const lines = [
          'info depth 14 multipv 1 score cp 80 pv e2e4',
          'info depth 14 multipv 2 score cp 10 pv h2h3',
          'bestmove h2h3',
        ];
        for (const line of lines) {
          for (const listener of listeners) {
            listener(line);
          }
        }
      }, 0);
    };
    const addLineListener = (listener: (line: string) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const registerAnalysisCancel: RegisterAnalysisCancel = () => () => undefined;

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
    );

    assert.ok(commands.some((cmd) => cmd.includes('UCI_LimitStrength value true')));
    assert.ok(move);
    assert.equal(move.from, 'h2');
    assert.equal(move.to, 'h3');
  });
});

describe('runCalibratedBotSearch Stockfish path (1700 Elo)', () => {
  it('returns a legal move and sends exact UCI_Elo 1700', async () => {
    const calibration = { ...getEloCalibration(1700), bestMoveProbability: 1 };
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const commands: string[] = [];

    const listeners = new Set<(line: string) => void>();
    const sendCommand = (command: string) => {
      commands.push(command);
      if (!command.startsWith('go ')) {
        return;
      }
      setTimeout(() => {
        for (const line of [
          'info depth 16 multipv 1 score cp 40 pv d2d4',
          'bestmove d2d4',
        ]) {
          for (const listener of listeners) {
            listener(line);
          }
        }
      }, 0);
    };
    const addLineListener = (listener: (line: string) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const registerAnalysisCancel: RegisterAnalysisCancel = () => () => undefined;

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
    );

    const preSearchCommands = commands.slice(
      0,
      commands.findIndex((cmd) => cmd.startsWith('go ')),
    );
    assert.ok(preSearchCommands.some((cmd) => cmd.includes('UCI_Elo value 1700')));
    assert.ok(!preSearchCommands.some((cmd) => cmd.includes('Skill Level')));
    assert.ok(move);
    assert.equal(move.from, 'd2');
    assert.equal(move.to, 'd4');
  });
});

describe('runCalibratedBotSearch Stockfish path (1320 Elo)', () => {
  it('returns a legal move and applies exact UCI_Elo strength', async () => {
    const calibration = { ...getEloCalibration(1320), bestMoveProbability: 1 };
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const commands: string[] = [];

    const listeners = new Set<(line: string) => void>();
    const sendCommand = (command: string) => {
      commands.push(command);
      if (!command.startsWith('go ')) {
        return;
      }
      setTimeout(() => {
        for (const line of [
          'info depth 15 multipv 1 score cp 35 pv e2e4',
          'bestmove e2e4',
        ]) {
          for (const listener of listeners) {
            listener(line);
          }
        }
      }, 0);
    };
    const addLineListener = (listener: (line: string) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const registerAnalysisCancel: RegisterAnalysisCancel = () => () => undefined;

    const move = await runCalibratedBotSearch(
      fen,
      calibration,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
    );

    assert.ok(commands.some((cmd) => cmd.includes('UCI_Elo value 1320')));
    const preSearchCommands = commands.slice(
      0,
      commands.findIndex((cmd) => cmd.startsWith('go ')),
    );
    assert.ok(!preSearchCommands.some((cmd) => cmd.includes('Skill Level')));
    assert.ok(move);
    assert.equal(move.from, 'e2');
    assert.equal(move.to, 'e4');
  });
});
