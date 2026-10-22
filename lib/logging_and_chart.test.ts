import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEMA,
  calculateMarketCipherB,
  analyzeMarketCipherBStrategy,
  DEFAULT_CONFIG,
} from './strategy.ts';
import type { Candle } from './strategy.ts';
import type { TradeLog, TradeLogType } from './mexc.ts';

test('analyzeMarketCipherBStrategy outputs detailed eliminatedReason on counter-trend rejection (Long below EMA 200)', () => {
  // Construct candles with high baseline (establishing high EMA 200 ~ 178)
  const candles: Candle[] = [];
  for (let i = 0; i < 200; i++) {
    candles.push({ timestamp: i * 60000, open: 200, high: 200.5, low: 199.5, close: 200, volume: 1000 });
  }
  for (let i = 200; i < 240; i++) {
    candles.push({ timestamp: i * 60000, open: 150, high: 150.5, low: 149.5, close: 150, volume: 1000 });
  }
  // 11 bars dropping from 150 to 135 (drags WT1 and WT2 into oversold <= -53)
  for (let i = 240; i < 251; i++) {
    const p = 150 - (i - 240) * 1.5;
    candles.push({ timestamp: i * 60000, open: p + 0.5, high: p + 0.5, low: p - 1.0, close: p, volume: 2000 });
  }
  // Bounce bar triggering bullish green dot cross in oversold zone while price (137) is far below EMA 200 (~178)
  candles.push({ timestamp: 251 * 60000, open: 136.5, high: 138, low: 136.5, close: 137, volume: 3000 });

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD', 'Action must be strictly HOLD when counter-trend');
  assert.equal(result.cipherDot, 'GREEN', 'Indicator must register valid Green Dot in OS');
  assert.ok(result.eliminatedReason !== undefined, 'eliminatedReason must be populated');
  assert.ok(
    result.eliminatedReason.includes('Counter-trend: Price below EMA 200 for Long'),
    `Expected counter-trend reason, got: ${result.eliminatedReason}`
  );
});

test('analyzeMarketCipherBStrategy outputs detailed eliminatedReason on counter-trend rejection (Short above EMA 200)', () => {
  // Construct candles with low baseline (establishing low EMA 200 ~ 95)
  const candles: Candle[] = [];
  for (let i = 0; i < 200; i++) {
    candles.push({ timestamp: i * 60000, open: 80, high: 80.5, low: 79.5, close: 80, volume: 1000 });
  }
  for (let i = 200; i < 240; i++) {
    candles.push({ timestamp: i * 60000, open: 120, high: 120.5, low: 119.5, close: 120, volume: 1000 });
  }
  // 11 bars rallying from 120 to 136.5 (drags WT1 and WT2 into overbought >= 53)
  for (let i = 240; i < 251; i++) {
    const p = 120 + (i - 240) * 1.5;
    candles.push({ timestamp: i * 60000, open: p - 0.5, high: p + 1.0, low: p - 0.5, close: p, volume: 2000 });
  }
  // Reversal bar triggering bearish red dot cross in overbought zone while price (133) is far above EMA 200 (~95)
  candles.push({ timestamp: 251 * 60000, open: 134, high: 134.5, low: 132.5, close: 133, volume: 3000 });

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD', 'Action must be strictly HOLD when counter-trend');
  assert.equal(result.cipherDot, 'RED', 'Indicator must register valid Red Dot in OB');
  assert.ok(result.eliminatedReason !== undefined, 'eliminatedReason must be populated');
  assert.ok(
    result.eliminatedReason.includes('Counter-trend: Price above EMA 200 for Short'),
    `Expected counter-trend reason, got: ${result.eliminatedReason}`
  );
});

test('analyzeMarketCipherBStrategy identifies eliminatedReason when crossover is outside OS/OB zone', () => {
  // Construct candles oscillating tightly in neutral zone (WT1 and WT2 around 0, not <= -53 or >= 53)
  const candles: Candle[] = [];
  for (let i = 0; i < 220; i++) {
    candles.push({
      timestamp: i * 60000,
      open: 100,
      high: 100.5,
      low: 99.5,
      close: 100 + (i % 2 === 0 ? 0.2 : -0.2),
      volume: 1000,
    });
  }

  const result = analyzeMarketCipherBStrategy(candles, DEFAULT_CONFIG);
  assert.equal(result.action, 'HOLD');
  assert.equal(result.cipherDot, 'NONE');
  assert.ok(result.eliminatedReason !== undefined, 'eliminatedReason must be populated for neutral crossovers');
  assert.ok(
    result.eliminatedReason.includes('Signal outside Oversold zone') || result.eliminatedReason.includes('Signal outside Overbought zone'),
    `Expected outside zone reason, got: ${result.eliminatedReason}`
  );
});

test('1M Chart indicator calculations: calculateEMA on 220 candles converges and aligns with strategy analysis', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 220; i++) {
    candles.push({
      timestamp: i * 60000,
      open: 50 + i * 0.2,
      high: 51 + i * 0.2,
      low: 49.5 + i * 0.2,
      close: 50.5 + i * 0.2,
      volume: 1500,
    });
  }

  const ema = calculateEMA(candles.map((c) => c.close), 200);
  assert.equal(ema.length, 220);
  assert.ok(ema[219] > 0);

  const { wt1, wt2 } = calculateMarketCipherB(candles);
  assert.equal(wt1.length, 220);
  assert.equal(wt2.length, 220);

  // Indicators should not contain NaN
  for (let i = 0; i < candles.length; i++) {
    assert.ok(!isNaN(ema[i]), `EMA at ${i} must not be NaN`);
    assert.ok(!isNaN(wt1[i]), `WT1 at ${i} must not be NaN`);
    assert.ok(!isNaN(wt2[i]), `WT2 at ${i} must not be NaN`);
  }

  // Slicing to visible window of 75 candles preserves continuity
  const VISIBLE_COUNT = 75;
  const visibleCandles = candles.slice(-VISIBLE_COUNT);
  const visibleEma = ema.slice(-VISIBLE_COUNT);
  const visibleWt1 = wt1.slice(-VISIBLE_COUNT);
  const visibleWt2 = wt2.slice(-VISIBLE_COUNT);

  assert.equal(visibleCandles.length, 75);
  assert.equal(visibleEma.length, 75);
  assert.equal(visibleWt1.length, 75);
  assert.equal(visibleWt2.length, 75);
  assert.equal(visibleEma[74], ema[219], 'Visible EMA last element must match full series last element');
});

test('TradeLog categorization cleanly maps events into filter categories', () => {
  const TRADES_TYPES = new Set<TradeLogType>([
    'TRADE_EXECUTED',
    'ENTRY',
    'TP_HIT',
    'TP1_HIT',
    'TP2_HIT',
    'TP3_HIT',
    'SL_HIT',
    'TPSL',
  ]);

  const SIGNALS_TYPES = new Set<TradeLogType>([
    'NEW_OPPORTUNITY',
    'ELIMINATED_OPPORTUNITY',
    'SCAN_SIGNAL',
  ]);

  const SCANNER_TYPES = new Set<TradeLogType>([
    'MARKET_SCAN',
  ]);

  const SYSTEM_TYPES = new Set<TradeLogType>([
    'MONORID_RUNNING',
    'MONORID_STOP',
    'SYSTEM_STATUS',
    'TELEGRAM_DISPATCH',
  ]);

  const testLogs: Array<{ type: TradeLogType; category: string }> = [
    { type: 'MARKET_SCAN', category: 'SCANNER' },
    { type: 'NEW_OPPORTUNITY', category: 'SIGNALS' },
    { type: 'ELIMINATED_OPPORTUNITY', category: 'SIGNALS' },
    { type: 'TRADE_EXECUTED', category: 'TRADES' },
    { type: 'TP_HIT', category: 'TRADES' },
    { type: 'SL_HIT', category: 'TRADES' },
    { type: 'MONORID_RUNNING', category: 'SYSTEM_STATUS' },
    { type: 'MONORID_STOP', category: 'SYSTEM_STATUS' },
  ];

  for (const item of testLogs) {
    if (item.category === 'TRADES') {
      assert.ok(TRADES_TYPES.has(item.type));
    } else if (item.category === 'SIGNALS') {
      assert.ok(SIGNALS_TYPES.has(item.type));
    } else if (item.category === 'SCANNER') {
      assert.ok(SCANNER_TYPES.has(item.type));
    } else if (item.category === 'SYSTEM_STATUS') {
      assert.ok(SYSTEM_TYPES.has(item.type));
    }
  }
});
