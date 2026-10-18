import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSMA,
  calculateATR,
  isPivotHigh,
  isPivotLow,
  analyzeLiquidityReaper,
  calculatePositionExitQuantity,
  DEFAULT_CONFIG,
} from './strategy.ts';
import type { Candle } from './strategy.ts';

test('calculateSMA computes correct rolling averages', () => {
  const data = [10, 20, 30, 40, 50];
  const sma3 = calculateSMA(data, 3);
  // for i=2: (10+20+30)/3 = 20
  // for i=3: (20+30+40)/3 = 30
  // for i=4: (30+40+50)/3 = 40
  assert.equal(sma3[2], 20);
  assert.equal(sma3[3], 30);
  assert.equal(sma3[4], 40);
});

test('calculateATR outputs valid volatility expansion series', () => {
  const mockCandles: Candle[] = [
    { timestamp: 1, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { timestamp: 2, open: 102, high: 110, low: 101, close: 108, volume: 1500 },
    { timestamp: 3, open: 108, high: 109, low: 99, close: 100, volume: 1200 },
    { timestamp: 4, open: 100, high: 106, low: 98, close: 104, volume: 1800 },
  ];
  const atr = calculateATR(mockCandles, 2);
  assert.ok(atr.length === 4);
  assert.ok(atr[3] > 0);
});

test('pivot detection confirms swing high and swing low structure', () => {
  const highs = [10, 12, 15, 14, 11];
  // index 2 is 15, left 2 (10, 12 < 15), right 2 (14, 11 < 15)
  assert.equal(isPivotHigh(highs, 2, 2, 2), true);
  assert.equal(isPivotHigh(highs, 1, 1, 1), false);

  const lows = [20, 18, 12, 14, 19];
  // index 2 is 12, left 2 (20, 18 > 12), right 2 (14, 19 > 12)
  assert.equal(isPivotLow(lows, 2, 2, 2), true);
});

test('calculatePositionExitQuantity enforces 25% TP1, 50% TP2, full remaining TP3', () => {
  const initialQty = 1000;
  const tp1 = calculatePositionExitQuantity(initialQty, 'TP1');
  assert.equal(tp1.closeQty, 250);
  assert.equal(tp1.closeFraction, 0.25);
  assert.equal(tp1.remainingQty, 750);

  const tp2 = calculatePositionExitQuantity(initialQty, 'TP2');
  assert.equal(tp2.closeQty, 500);
  assert.equal(tp2.closeFraction, 0.5);
  assert.equal(tp2.remainingQty, 250);

  const tp3 = calculatePositionExitQuantity(initialQty, 'TP3');
  assert.equal(tp3.closeQty, 1000);
  assert.equal(tp3.remainingQty, 0);

  const sl = calculatePositionExitQuantity(initialQty, 'SL');
  assert.equal(sl.closeQty, 1000);
  assert.equal(sl.remainingQty, 0);
});

test('analyzeLiquidityReaper returns complete risk targets when signals generate', () => {
  // Generate 40 synthetic candles forming a swing low followed by a liquidity sweep
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 40; i++) {
    // create a dip at bar 15 to form swing low
    if (i === 15) {
      price = 85;
    } else if (i > 15 && i < 30) {
      price = 95 + (i % 3);
    } else if (i === 32) {
      // sweep below 85 with wick to 83, closing at 88
      candles.push({
        timestamp: i * 300000,
        open: 89,
        high: 90,
        low: 82,
        close: 88,
        volume: 5000, // high volume
      });
      continue;
    } else {
      price = 95 + (i % 5);
    }
    candles.push({
      timestamp: i * 300000,
      open: price - 0.5,
      high: price + 1.5,
      low: price - 1.5,
      close: price,
      volume: 1000,
    });
  }

  const result = analyzeLiquidityReaper(candles, {
    ...DEFAULT_CONFIG,
    pivotLen: 3,
    confirmWindow: 3,
  });

  assert.ok(result.volMultiplier !== undefined);
  assert.ok(result.atr >= 0);
  assert.ok(result.pendingSweepText.length > 0);
  assert.ok(result.recommendedLeverage >= 10 && result.recommendedLeverage <= 15);
});
