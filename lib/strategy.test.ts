import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSMA,
  calculateEMA,
  calculateMarketCipherB,
  analyzeMarketCipherBStrategy,
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

test('calculateMarketCipherB computes wt1 and wt2 series', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 50; i++) {
    candles.push({
      timestamp: i * 60000,
      open: 100 + i * 0.1,
      high: 101 + i * 0.1,
      low: 99 + i * 0.1,
      close: 100.5 + i * 0.1,
      volume: 1000,
    });
  }
  const result = calculateMarketCipherB(candles, 10, 21);
  assert.equal(result.wt1.length, 50);
  assert.equal(result.wt2.length, 50);
  // wt2 is SMA(wt1, 4), verify no NaN
  for (let i = 0; i < 50; i++) {
    assert.ok(!isNaN(result.wt1[i]), `wt1[${i}] is NaN`);
    assert.ok(!isNaN(result.wt2[i]), `wt2[${i}] is NaN`);
  }
});

test('analyzeMarketCipherBStrategy returns HOLD with insufficient bars', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 30; i++) {
    candles.push({
      timestamp: i * 60000,
      open: 100 + i,
      high: 102 + i,
      low: 98 + i,
      close: 101 + i,
      volume: 1000,
    });
  }
  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD');
  assert.ok(result.message.includes('Insufficient'));
  assert.equal(result.confidence, 0);
});

test('analyzeMarketCipherBStrategy executes BUY on Green Dot in Oversold Zone when Price > EMA 200', () => {
  const candles: Candle[] = [];
  // 200 baseline bars at 50
  for (let i = 0; i < 200; i++) {
    candles.push({ timestamp: i * 60000, open: 50, high: 50.5, low: 49.5, close: 50, volume: 1000 });
  }
  // 40 bars stable at 150 (establishes high trend above EMA 200)
  for (let i = 200; i < 240; i++) {
    candles.push({ timestamp: i * 60000, open: 150, high: 150.5, low: 149.5, close: 150, volume: 1000 });
  }
  // 11 bars dropping from 150 to 135 (drags WT1 and WT2 deep into oversold <= -53)
  for (let i = 240; i < 251; i++) {
    const p = 150 - (i - 240) * 1.5;
    candles.push({ timestamp: i * 60000, open: p + 0.5, high: p + 0.5, low: p - 1.0, close: p, volume: 2000 });
  }
  // Bounce bar that triggers bullish green dot cross in oversold zone
  candles.push({ timestamp: 251 * 60000, open: 136.5, high: 138, low: 136.5, close: 137, volume: 3000 });

  const ema = calculateEMA(candles.map(c => c.close), 200);
  const lastIdx = candles.length - 1;
  const currentPrice = candles[lastIdx].close;
  const currentEMA = ema[lastIdx];

  assert.ok(currentPrice > currentEMA, `Expected price ${currentPrice} > EMA ${currentEMA}`);

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);

  assert.equal(result.action, 'BUY');
  assert.equal(result.signalType, 'CIPHER_B_GREEN_DOT');
  assert.equal(result.cipherDot, 'GREEN');
  assert.ok(result.slLevel !== undefined);
  assert.ok(result.tpLevel !== undefined);
  // Stop loss strictly below EMA 200
  assert.ok(result.slLevel < currentEMA, `SL ${result.slLevel} must be strictly below EMA 200 (${currentEMA})`);
  // Take Profit strictly 1:2 Risk to Reward
  const risk = result.entryPrice! - result.slLevel;
  const reward = result.tpLevel - result.entryPrice!;
  assert.ok(Math.abs(reward / risk - 2.0) < 0.001, `R:R must be 2.0 (got ${reward / risk})`);
  assert.ok(result.confidence >= 80, `Confidence must be >= 80% (got ${result.confidence})`);
});

test('analyzeMarketCipherBStrategy executes SHORT on Red Dot in Overbought Zone when Price < EMA 200', () => {
  const candles: Candle[] = [];
  // 200 baseline bars at 120
  for (let i = 0; i < 200; i++) {
    candles.push({ timestamp: i * 60000, open: 120, high: 120.5, low: 119.5, close: 120, volume: 1000 });
  }
  // 40 bars stable at 80 (establishes low trend below EMA 200)
  for (let i = 200; i < 240; i++) {
    candles.push({ timestamp: i * 60000, open: 80, high: 80.5, low: 79.5, close: 80, volume: 1000 });
  }
  // 11 bars rallying from 80 to 96.5 (pushes WT1 and WT2 into overbought >= 53)
  for (let i = 240; i < 251; i++) {
    const p = 80 + (i - 240) * 1.5;
    candles.push({ timestamp: i * 60000, open: p - 0.5, high: p + 1.0, low: p - 0.5, close: p, volume: 2000 });
  }
  // Down bar that triggers bearish red dot cross in overbought zone below EMA 200
  candles.push({ timestamp: 251 * 60000, open: 93.5, high: 93.5, low: 92.0, close: 93, volume: 3000 });

  const ema = calculateEMA(candles.map(c => c.close), 200);
  const lastIdx = candles.length - 1;
  const currentPrice = candles[lastIdx].close;
  const currentEMA = ema[lastIdx];

  assert.ok(currentPrice < currentEMA, `Expected price ${currentPrice} < EMA ${currentEMA}`);

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);

  assert.equal(result.action, 'SELL');
  assert.equal(result.signalType, 'CIPHER_B_RED_DOT');
  assert.equal(result.cipherDot, 'RED');
  assert.ok(result.slLevel !== undefined);
  assert.ok(result.tpLevel !== undefined);
  // Stop loss strictly above EMA 200
  assert.ok(result.slLevel > currentEMA, `SL ${result.slLevel} must be strictly above EMA 200 (${currentEMA})`);
  // Take Profit strictly 1:2 Risk to Reward
  const risk = result.slLevel - result.entryPrice!;
  const reward = result.entryPrice! - result.tpLevel;
  assert.ok(Math.abs(reward / risk - 2.0) < 0.001, `R:R must be 2.0 (got ${reward / risk})`);
  assert.ok(result.confidence >= 80, `Confidence must be >= 80% (got ${result.confidence})`);
});

test('analyzeMarketCipherBStrategy strictly blocks BUY when price is below EMA 200 even with Green Dot', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 220; i++) {
    candles.push({
      timestamp: i * 60000,
      open: 100 - i * 0.2, // downtrend
      high: 101 - i * 0.2,
      low: 99 - i * 0.2,
      close: 100 - i * 0.2,
      volume: 1000,
    });
  }

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  // Below EMA 200 must NEVER generate a BUY
  assert.notEqual(result.action, 'BUY');
});

test('analyzeMarketCipherBStrategy strictly blocks SELL when price is above EMA 200 even with Red Dot', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 220; i++) {
    candles.push({
      timestamp: i * 60000,
      open: 100 + i * 0.2, // uptrend
      high: 101 + i * 0.2,
      low: 99 + i * 0.2,
      close: 100 + i * 0.2,
      volume: 1000,
    });
  }

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  // Above EMA 200 must NEVER generate a SELL
  assert.notEqual(result.action, 'SELL');
});

test('calculatePositionExitQuantity enforces 100% exit at 1:2 TP and SL', () => {
  const qty = 500;
  const tpExit = calculatePositionExitQuantity(qty, 'TP1');
  assert.equal(tpExit.closeFraction, 1.0);
  assert.equal(tpExit.closeQty, 500);
  assert.equal(tpExit.remainingQty, 0);

  const slExit = calculatePositionExitQuantity(qty, 'SL');
  assert.equal(slExit.closeFraction, 1.0);
  assert.equal(slExit.closeQty, 500);
  assert.equal(slExit.remainingQty, 0);

  const singleTp = calculatePositionExitQuantity(1, 'TP1');
  assert.equal(singleTp.closeFraction, 1.0);
  assert.equal(singleTp.closeQty, 1);
  assert.equal(singleTp.remainingQty, 0);
});
