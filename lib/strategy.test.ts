import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  analyzeCrudeOilStrategy,
  calculatePositionExitQuantity,
  DEFAULT_CONFIG,
} from './strategy.ts';
import type { Candle } from './strategy.ts';

test('calculateSMA computes correct rolling averages', () => {
  const data = [10, 20, 30, 40, 50];
  const sma3 = calculateSMA(data, 3);
  assert.equal(sma3[2], 20);
  assert.equal(sma3[3], 30);
  assert.equal(sma3[4], 40);
});

test('calculateEMA outputs valid exponential moving average', () => {
  const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const ema5 = calculateEMA(data, 5);
  assert.ok(ema5.length === data.length);
  assert.ok(ema5[4] > 0);
  assert.ok(ema5[10] > ema5[4]);
});

test('calculateRSI outputs values between 0 and 100', () => {
  const data = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
  const rsi = calculateRSI(data, 14);
  assert.ok(rsi.length === data.length);
  for (const val of rsi.slice(14)) {
    assert.ok(val >= 0 && val <= 100, `RSI value ${val} out of range`);
  }
});

test('analyzeCrudeOilStrategy returns HOLD with insufficient bars', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp: i * 180000,
      open: 100 + i,
      high: 102 + i,
      low: 98 + i,
      close: 101 + i,
      volume: 1000,
    });
  }
  const result = analyzeCrudeOilStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD');
  assert.ok(result.message.includes('Insufficient'));
});

test('analyzeCrudeOilStrategy detects BUY signal with EMA filter', () => {
  const candles: Candle[] = [];
  const basePrice = 100;
  
  for (let i = 0; i < 210; i++) {
    let close = basePrice + i * 0.5;
    if (i < 200) {
      close = basePrice + i * 0.3;
    }
    candles.push({
      timestamp: i * 180000,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close: close,
      volume: 1000,
    });
  }
  
  const result = analyzeCrudeOilStrategy(candles, DEFAULT_CONFIG);
  assert.ok(['BUY', 'SELL', 'HOLD'].includes(result.action));
  assert.ok(result.rsi >= 0 && result.rsi <= 100);
  assert.ok(result.sma > 0);
  assert.ok(result.ema > 0);
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
