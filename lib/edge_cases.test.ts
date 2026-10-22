import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeMarketCipherBStrategy,
  analyzeCrudeOilStrategy,
  calculatePositionExitQuantity,
  calculateMarketCipherB,
  calculateEMA,
  DEFAULT_CONFIG,
} from './strategy.ts';
import type { Candle } from './strategy.ts';
import {
  formatTriggerPrice,
  deduplicateClosedPositions,
  extractOrderFeeAndFunding,
  type MexcPosition,
} from './mexc.ts';

test('analyzeMarketCipherBStrategy handles flat / zero-volatility candles gracefully', () => {
  const flatCandles: Candle[] = [];
  for (let i = 0; i < 220; i++) {
    flatCandles.push({
      timestamp: i * 60000,
      open: 50.0,
      high: 50.0,
      low: 50.0,
      close: 50.0,
      volume: 0,
    });
  }
  const result = analyzeMarketCipherBStrategy(flatCandles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD');
  assert.equal(result.confidence, 0);
  assert.equal(result.signalType, 'NONE');
  assert.equal(result.cipherDot, 'NONE');
  assert.ok(!isNaN(result.wt1));
  assert.ok(!isNaN(result.wt2));
});

test('calculateMarketCipherB handles zero-variance candles without division by zero NaN', () => {
  const flatCandles: Candle[] = [];
  for (let i = 0; i < 60; i++) {
    flatCandles.push({
      timestamp: i * 60000,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 0,
    });
  }
  const result = calculateMarketCipherB(flatCandles, 10, 21);
  for (let i = 0; i < 60; i++) {
    assert.ok(!isNaN(result.wt1[i]), `wt1[${i}] should not be NaN`);
    assert.ok(!isNaN(result.wt2[i]), `wt2[${i}] should not be NaN`);
    assert.ok(isFinite(result.wt1[i]), `wt1[${i}] should be finite`);
    assert.ok(isFinite(result.wt2[i]), `wt2[${i}] should be finite`);
  }
});

test('analyzeMarketCipherBStrategy blocks counter-trend short signals when price is in an aggressive bull trend', () => {
  const candles: Candle[] = [];
  // Build a strong bull trend above EMA-200
  for (let i = 0; i < 220; i++) {
    const close = 100 + i * 1.5;
    candles.push({
      timestamp: i * 60000,
      open: close - 0.5,
      high: close + 1.0,
      low: close - 0.5,
      close: close,
      volume: 5000,
    });
  }

  // Artificial dip bar that dips briefly but is way above EMA-200
  const lastC = candles[candles.length - 1].close;
  candles.push({
    timestamp: 221 * 60000,
    open: lastC,
    high: lastC + 0.1,
    low: lastC - 5.0,
    close: lastC - 4.5,
    volume: 8000,
  });

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);

  // Short must be strictly blocked because price is above EMA-200
  assert.notEqual(result.action, 'SELL', 'Bullish trend (Price > EMA 200) must strictly prevent counter-trend SELL signal');
});

test('analyzeMarketCipherBStrategy blocks counter-trend long signals when price is in an aggressive bear trend', () => {
  const candles: Candle[] = [];
  // Build a strong bear trend below EMA-200
  for (let i = 0; i < 220; i++) {
    const close = 300 - i * 1.0;
    candles.push({
      timestamp: i * 60000,
      open: close + 0.5,
      high: close + 0.5,
      low: close - 1.0,
      close: close,
      volume: 5000,
    });
  }

  // Brief bounce bar below EMA-200
  const lastC = candles[candles.length - 1].close;
  candles.push({
    timestamp: 221 * 60000,
    open: lastC,
    high: lastC + 3.0,
    low: lastC - 0.2,
    close: lastC + 2.5,
    volume: 8000,
  });

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);

  // Long must be strictly blocked because price is below EMA-200
  assert.notEqual(result.action, 'BUY', 'Bearish trend (Price < EMA 200) must strictly prevent counter-trend BUY signal');
});

test('calculatePositionExitQuantity correctly handles edge case sizes (0, 1, 2, 3, 5, 100) with 100% 1:2 TP exit', () => {
  // 0 size
  const zeroExit = calculatePositionExitQuantity(0, 'TP1');
  assert.equal(zeroExit.closeQty, 0);
  assert.equal(zeroExit.remainingQty, 0);

  // 1 contract
  const singleTp1 = calculatePositionExitQuantity(1, 'TP1');
  assert.equal(singleTp1.closeQty, 1);
  assert.equal(singleTp1.remainingQty, 0);
  assert.equal(singleTp1.closeFraction, 1.0);

  // 2 contracts
  const twoTp1 = calculatePositionExitQuantity(2, 'TP1');
  assert.equal(twoTp1.closeQty, 2);
  assert.equal(twoTp1.remainingQty, 0);
  assert.equal(twoTp1.closeFraction, 1.0);

  // 5 contracts
  const fiveTp1 = calculatePositionExitQuantity(5, 'TP1');
  assert.equal(fiveTp1.closeQty, 5);
  assert.equal(fiveTp1.remainingQty, 0);
  assert.equal(fiveTp1.closeFraction, 1.0);

  // 100 contracts
  const c100Tp1 = calculatePositionExitQuantity(100, 'TP1');
  assert.equal(c100Tp1.closeQty, 100);
  assert.equal(c100Tp1.remainingQty, 0);
  assert.equal(c100Tp1.closeFraction, 1.0);
});

test('calculateEMA handles short data series gracefully without NaN or flat zeroes', () => {
  const shortData = [10, 12, 11, 14, 13, 16, 15, 18, 17, 20];
  const ema = calculateEMA(shortData, 50); // length is longer than data
  assert.equal(ema.length, shortData.length);
  for (const val of ema) {
    assert.ok(!isNaN(val) && val > 0, `EMA value must be valid positive number, got ${val}`);
  }
  assert.ok(ema[ema.length - 1] > ema[0], 'EMA should reflect upward trend in short series');
});

test('calculatePositionExitQuantity on SL closes all units regardless of size', () => {
  for (const qty of [1, 2, 7, 25, 1000]) {
    const sl = calculatePositionExitQuantity(qty, 'SL');
    assert.equal(sl.closeQty, qty);
    assert.equal(sl.remainingQty, 0);
    assert.equal(sl.closeFraction, 1.0);
  }
});

test('analyzeMarketCipherBStrategy guards against negative TP on extreme short conditions by returning HOLD', () => {
  const candles: Candle[] = [];
  // Extreme setup: baseline EMA at 150, but price crashed to 50
  for (let i = 0; i < 200; i++) {
    candles.push({ timestamp: i * 60000, open: 150, high: 150.5, low: 149.5, close: 150, volume: 1000 });
  }
  for (let i = 200; i < 240; i++) {
    candles.push({ timestamp: i * 60000, open: 50, high: 50.5, low: 49.5, close: 50, volume: 1000 });
  }
  for (let i = 240; i < 251; i++) {
    const p = 50 + (i - 240) * 1.5;
    candles.push({ timestamp: i * 60000, open: p - 0.5, high: p + 1.0, low: p - 0.5, close: p, volume: 2000 });
  }
  // Drop bar: price at 63, EMA at ~110, risk distance is 47.7, so 1:2 TP would be 63 - 95.4 = -32.4
  candles.push({ timestamp: 251 * 60000, open: 63.5, high: 63.5, low: 62.0, close: 63, volume: 3000 });

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD', 'Extreme short with negative TP must safely return HOLD');
  assert.equal(result.confidence, 0);
  assert.ok(result.message.includes('below zero'));
});

test('analyzeMarketCipherBStrategy triggers on completed candle crossover when newly closed', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 200; i++) candles.push({ timestamp: i * 60000, open: 50, high: 50.5, low: 49.5, close: 50, volume: 1000 });
  for (let i = 200; i < 240; i++) candles.push({ timestamp: i * 60000, open: 150, high: 150.5, low: 149.5, close: 150, volume: 1000 });
  for (let i = 240; i < 251; i++) {
    const p = 150 - (i - 240) * 1.5;
    candles.push({ timestamp: i * 60000, open: p + 0.5, high: p + 0.5, low: p - 1.0, close: p, volume: 2000 });
  }
  // Bar 251: Crossover occurs
  candles.push({ timestamp: 251 * 60000, open: 136.5, high: 138, low: 136.5, close: 137, volume: 3000 });
  // Bar 252: Newly completed bar
  candles.push({ timestamp: 252 * 60000, open: 137, high: 139.5, low: 137, close: 139, volume: 3000 });

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'BUY');
  assert.equal(result.cipherDot, 'GREEN');
  assert.equal(result.candleTiming, 'COMPLETED_CANDLE');
});

test('formatTriggerPrice strictly respects MEXC priceScale and contract precision', () => {
  // BTC (priceScale 1)
  assert.equal(formatTriggerPrice(83005.81234, 1), 83005.8);
  // ETH (priceScale 2)
  assert.equal(formatTriggerPrice(2645.129, 2), 2645.13);
  // DOGE (priceScale 5)
  assert.equal(formatTriggerPrice(0.1987654, 5), 0.19877);
  // PEPE (priceScale 10)
  assert.equal(formatTriggerPrice(0.000000851234, 10), 0.0000008512);
  // Negative or NaN protection
  assert.equal(formatTriggerPrice(-10, 2), 0);
  assert.equal(formatTriggerPrice(NaN, 2), 0);
});

test('deduplicateClosedPositions handles empty arrays, undefined values, and single positions safely', () => {
  assert.deepEqual(deduplicateClosedPositions([]), []);
  assert.deepEqual(deduplicateClosedPositions(undefined as any), []);
  assert.deepEqual(deduplicateClosedPositions(null as any), []);

  const singlePos: MexcPosition = {
    id: 'pos-1',
    symbol: 'BTC_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'LONG',
    entryPrice: 50000,
    currentPrice: 51000,
    exitPrice: 51000,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 49000,
    tp1Price: 52000,
    tp2Price: 52000,
    tp3Price: 52000,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 1.0,
    status: 'CLOSED',
    createdAt: 1000,
    closedAt: 2000,
  };
  const res = deduplicateClosedPositions([singlePos]);
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'pos-1');
  assert.equal(res[0].netRealizedPnl, 1.0);
});

test('deduplicateClosedPositions merges duplicate entries with 0 closedAt timestamps without NaN or throwing', () => {
  const p1: MexcPosition = {
    id: 'pos-SNXX-1',
    symbol: 'SNXX_USDT',
    groupName: 'AI & Cyber Innovators',
    botId: 'volatility-reaper',
    botCode: 'VOLATILITY REAPER',
    botName: 'Volatility Reaper',
    side: 'SHORT',
    entryPrice: 1.0,
    currentPrice: 1.05,
    exitPrice: 1.05,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 10,
    closedVol: 10,
    slPrice: 1.05,
    tp1Price: 0.9,
    tp2Price: 0.9,
    tp3Price: 0.9,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: true,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.5,
    status: 'CLOSED',
    createdAt: 100000,
    closeReason: 'SL',
  };

  const p2: MexcPosition = {
    id: 'mexc-12345678',
    orderId: '12345678',
    symbol: 'SNXX_USDT',
    groupName: 'Resynced (Exchange)',
    botId: 'rapid-scalper',
    botCode: 'RAPID SCALPER',
    botName: 'Rapid Scalper',
    side: 'SHORT',
    entryPrice: 1.0,
    currentPrice: 1.05,
    exitPrice: 1.05,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 10,
    closedVol: 10,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.0,
    fee: 0.005,
    fundingFee: -0.001,
    status: 'CLOSED',
    createdAt: 100001,
    closeReason: 'TP1',
  };

  const res = deduplicateClosedPositions([p1, p2]);
  assert.equal(res.length, 1);
  assert.equal(res[0].botName, 'Volatility Reaper');
  assert.equal(res[0].closeReason, 'SL');
  assert.equal(res[0].realizedPnl, -0.5);
  assert.equal(res[0].fee, 0.005);
  assert.equal(res[0].fundingFee, -0.001);
  assert.equal(res[0].netRealizedPnl, -0.506); // -0.5 - 0.005 + (-0.001)
});
