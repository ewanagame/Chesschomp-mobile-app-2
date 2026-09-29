import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { waitUntilPlayerMoveQualityVisible } from './playerClassificationGate';

describe('waitUntilPlayerMoveQualityVisible', () => {
  it('does not paint until classification has settled', async () => {
    const order: string[] = [];
    let settleClassification: () => void = () => undefined;
    const classification = new Promise<void>((resolve) => {
      settleClassification = () => {
        order.push('classified');
        resolve();
      };
    });

    const visible = waitUntilPlayerMoveQualityVisible(classification, async () => {
      order.push('painted');
    });

    assert.deepEqual(order, []);
    settleClassification();
    await visible;
    assert.deepEqual(order, ['classified', 'painted']);
  });
});
