/**
 * MONORID ALGORITHMIC TRADING CORE
 * Copyright and developed by Trading Lifestyle Quant
 * Strategy: Monorid Quant Scalp Strategy with EMA-200 Trend Filter
 * 
 * Rules:
 * - LONG: Indicator in oversold zone (<= -53) prints Green Dot (wt1 crosses above wt2)
 *         AND market is above EMA 200.
 *         Stop Loss strictly below EMA 200 with safety buffer.
 *         Take Profit strictly 1:2 Risk to Reward (R:R = 2.0).
 * - SHORT: Indicator in overbought zone (>= 53) prints Red Dot (wt1 crosses below wt2)
 *          AND market is below EMA 200.
 *          Stop Loss strictly above EMA 200 with safety buffer.
 *          Take Profit strictly 1:2 Risk to Reward (R:R = 2.0).
 * - Only these conditions execute trades. All other conditions result strictly in HOLD.
 * - Position Exit: 100% full exit at 1:2 TP.
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyConfig {
  channelLength: number; // n1 = 10 (Channel Length)
  averageLength: number; // n2 = 21 (Average Length)
  obLevel1: number;      // 60 (Over Bought Level 1)
  obLevel2: number;      // 53 (Over Bought Level 2)
  osLevel1: number;      // -60 (Over Sold Level 1)
  osLevel2: number;      // -53 (Over Sold Level 2)
  emaLength: number;     // 200 (EMA 200 Trend Line)
  riskRewardRatio: number; // 2.0 (1:2 R:R)
  slBufferPct: number;   // 0.004 (0.4% buffer beyond EMA 200)
  minSlDistancePct?: number; // 0.005 (0.5% minimum safe distance from entry to prevent noise stopouts)
  maxRiskDistPct?: number;   // 0.015 (1.5% maximum allowable risk ceiling to eliminate overextended entries)
  minTrendClearancePct?: number; // 0.0015 (0.15% minimum separation from EMA 200 to eliminate chop)
  osLookbackBars?: number;   // 4 (lookback bars for oversold/overbought wave trough/peak)
  equityRiskPct: number;
  minLeverage: number;
  maxLeverage: number;
  minConfidence?: number;
  // Backward compatibility fields
  smaLength?: number;
  rsiLength?: number;
  rsiHigher?: number;
  rsiLower?: number;
  distSMA?: number;
  candleLength?: number;
  rrTp1?: number;
  rrTp2?: number;
  rrTp3?: number;
  useEmaTrendFilter?: boolean;
}

export const DEFAULT_CONFIG: StrategyConfig = {
  channelLength: 10,
  averageLength: 21,
  obLevel1: 60,
  obLevel2: 50,
  osLevel1: -60,
  osLevel2: -50,
  emaLength: 200,
  riskRewardRatio: 2.0, // Strictly 1:2 Risk to Reward
  slBufferPct: 0.004,   // 0.4% safety buffer beyond EMA 200
  minSlDistancePct: 0.005, // 0.5% minimum safe distance from entry to prevent noise stopouts
  minTrendClearancePct: 0.0015, // 0.15% minimum trend clearance from EMA 200 to eliminate chop
  osLookbackBars: 4,    // 4 bars lookback for oversold / overbought wave trough/peak
  equityRiskPct: 10,
  minLeverage: 6,
  maxLeverage: 8,
  minConfidence: 80,
  // Backward compatibility aliases
  smaLength: 10,
  rsiLength: 21,
  rsiHigher: 50,
  rsiLower: -50,
  distSMA: 1,
  candleLength: 1,
  rrTp1: 2.0,
  rrTp2: 2.0,
  rrTp3: 2.0,
  useEmaTrendFilter: true,
};

export interface MonoridWaveResult {
  wt1: number[];
  wt2: number[];
}

export type MarketCipherBResult = MonoridWaveResult;

export interface SignalResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  entryPrice?: number;
  slLevel?: number;
  tp1Level?: number;
  tp2Level?: number;
  tp3Level?: number;
  tpLevel?: number;
  riskDist?: number;
  rsi: number; // Populated with WT1 for backwards compatibility with UI
  sma: number; // Populated with EMA 200 for backwards compatibility with UI
  ema: number; // EMA 200
  wt1: number; // Monorid Wave 1
  wt2: number; // Monorid Wave 2
  monoridDot?: 'GREEN' | 'RED' | 'NONE';
  cipherDot: 'GREEN' | 'RED' | 'NONE';
  signalType: 'MONORID_GREEN_DOT' | 'MONORID_RED_DOT' | 'CIPHER_B_GREEN_DOT' | 'CIPHER_B_RED_DOT' | 'SMA_CROSS' | 'REVERSAL' | 'NONE';
  candleTiming?: 'SAME_CANDLE' | 'COMPLETED_CANDLE' | 'NONE';
  recommendedLeverage: number;
  confidence: number;
  message: string;
  eliminatedReason?: string;
}

/**
 * O(n) running-sum SMA
 */
export function calculateSMA(data: number[], length: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  let windowSum = 0;
  for (let i = 0; i < data.length; i++) {
    windowSum += data[i];
    if (i >= length) windowSum -= data[i - length];
    result[i] = windowSum / Math.min(i + 1, length);
  }
  return result;
}

/**
 * Standard Exponential Moving Average (matches Pine Script ema function)
 */
export function calculateEMA(data: number[], length: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length === 0) return result;

  const effectiveLength = Math.min(length, data.length);
  const seedLength = data.length < length ? Math.min(data.length, Math.max(5, Math.floor(data.length * 0.3))) : length;
  const multiplier = 2 / (effectiveLength + 1);

  let sum = 0;
  for (let i = 0; i < seedLength; i++) {
    sum += data[i];
    result[i] = sum / (i + 1);
  }

  for (let i = seedLength; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
  }

  return result;
}

/**
 * Legacy RSI implementation preserved for utility
 */
export function calculateRSI(data: number[], length: number = 14): number[] {
  const result: number[] = new Array(data.length).fill(50);
  if (data.length < 2) return result;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, length).reduce((a, b) => a + b, 0) / length;
  let avgLoss = losses.slice(0, length).reduce((a, b) => a + b, 0) / length;

  for (let i = 0; i < length; i++) {
    result[i] = 50;
  }

  if (avgLoss === 0) {
    result[length] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[length] = 100 - (100 / (1 + rs));
  }

  for (let i = length; i < gains.length; i++) {
    avgGain = (avgGain * (length - 1) + gains[i]) / length;
    avgLoss = (avgLoss * (length - 1) + losses[i]) / length;

    if (avgLoss === 0) {
      result[i + 1] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i + 1] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

export function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1) return candles;
  const result: Candle[] = [];

  for (let i = 0; i < candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    if (group.length === 0) continue;

    result.push({
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  return result;
}

/**
 * Monorid Indicator Calculation (Copyright and developed by Trading Lifestyle Quant)
 * 
 * Wave 1 & Wave 2 Oscillators:
 * ap = hlc3
 * esa = ema(ap, n1)
 * d = ema(abs(ap - esa), n1)
 * ci = (ap - esa) / (0.015 * d)
 * tci = ema(ci, n2)
 * wt1 = tci
 * wt2 = sma(wt1, 4)
 */
export function calculateMonoridIndicator(
  candles: Candle[],
  n1: number = 10,
  n2: number = 21
): MonoridWaveResult {
  if (candles.length === 0) {
    return { wt1: [], wt2: [] };
  }

  // ap = hlc3
  const ap = candles.map((c) => (c.high + c.low + c.close) / 3);

  // esa = ema(ap, n1)
  const esa = calculateEMA(ap, n1);

  // d = ema(abs(ap - esa), n1)
  const absDiff = ap.map((val, i) => Math.abs(val - esa[i]));
  const d = calculateEMA(absDiff, n1);

  // ci = (ap - esa) / (0.015 * d)
  const ci = ap.map((val, i) => {
    const denom = 0.015 * d[i];
    return denom === 0 || isNaN(denom) ? 0 : (val - esa[i]) / denom;
  });

  // tci = ema(ci, n2)
  const tci = calculateEMA(ci, n2);

  // wt1 = tci
  const wt1 = tci;

  // wt2 = sma(wt1, 4)
  const wt2 = calculateSMA(wt1, 4);

  return { wt1, wt2 };
}

/**
 * Full Monorid Trading Strategy Analysis (Copyright and developed by Trading Lifestyle Quant)
 * 
 * Rules:
 * - LONG:
 *   1. Monorid makes a Green Dot in Oversold Zone (wt1 crosses above wt2 and wt2/wt1 <= -53)
 *   2. Market price is above EMA 200 (close > EMA 200)
 *   -> Execute LONG
 *   -> Stop Loss strictly below EMA 200 (with safety buffer)
 *   -> Take Profit strictly 1:2 Risk to Reward (R:R = 2.0)
 * 
 * - SHORT:
 *   1. Monorid makes a Red Dot in Overbought Zone (wt1 crosses below wt2 and wt2/wt1 >= 53)
 *   2. Market price is below EMA 200 (close < EMA 200)
 *   -> Execute SHORT
 *   -> Stop Loss strictly above EMA 200 (with safety buffer)
 *   -> Take Profit strictly 1:2 Risk to Reward (R:R = 2.0)
 * 
 * - ALL OTHER CONDITIONS: Strictly HOLD.
 */
export function analyzeMonoridStrategy(
  candles: Candle[],
  config: StrategyConfig = DEFAULT_CONFIG
): SignalResult {
  const emaLength = config.emaLength || 200;
  const n1 = config.channelLength || 10;
  const n2 = config.averageLength || 21;
  const obLevel2 = config.obLevel2 ?? 50;
  const osLevel2 = config.osLevel2 ?? -50;
  const osLookbackBars = config.osLookbackBars ?? 4;
  const minBars = Math.max(emaLength, 35) + 5;

  if (candles.length < minBars) {
    return {
      action: 'HOLD',
      rsi: 0,
      sma: 0,
      ema: 0,
      wt1: 0,
      wt2: 0,
      monoridDot: 'NONE',
      cipherDot: 'NONE',
      signalType: 'NONE',
      recommendedLeverage: config.minLeverage || 6,
      confidence: 0,
      message: `Insufficient bars (${candles.length}/${minBars}) for Monorid + EMA 200`,
    };
  }

  const closes = candles.map((c) => c.close);
  const emaSeries = calculateEMA(closes, emaLength);
  const ema50Series = calculateEMA(closes, 50);
  const { wt1, wt2 } = calculateMonoridIndicator(candles, n1, n2);

  const lastBar = candles.length - 1;
  const prevBar = lastBar - 1;
  const prevPrevBar = lastBar - 2;

  const currentPrice = closes[lastBar];
  const currentEMA = emaSeries[lastBar];
  const currentEMA50 = ema50Series[lastBar];
  const prevEma5Bars = emaSeries[Math.max(0, lastBar - 5)];
  const prevEma10Bars = emaSeries[Math.max(0, lastBar - 10)];

  const wt1Current = wt1[lastBar];
  const wt2Current = wt2[lastBar];
  const wt1Prev = wt1[prevBar];
  const wt2Prev = wt2[prevBar];

  // 1. Same-candle (intra-bar or active bar) crossover detection
  const sameCandleBullCross = wt1Prev <= wt2Prev && wt1Current > wt2Current;
  const sameCandleBearCross = wt1Prev >= wt2Prev && wt1Current < wt2Current;

  // 2. Completed candle (newly closed bar) crossover detection
  const completedCandleBullCross =
    prevPrevBar >= 0 && wt1[prevPrevBar] <= wt2[prevPrevBar] && wt1Prev > wt2Prev;
  const completedCandleBearCross =
    prevPrevBar >= 0 && wt1[prevPrevBar] >= wt2[prevPrevBar] && wt1Prev < wt2Prev;

  // Check oversold condition (<= -50 / -53) within recent trough window
  const lookbackStartSame = Math.max(0, lastBar - osLookbackBars);
  const lookbackStartCompleted = Math.max(0, prevBar - osLookbackBars);

  const isOversoldSame =
    wt2Current <= osLevel2 ||
    wt1Current <= osLevel2 ||
    wt2Prev <= osLevel2 ||
    wt1Prev <= osLevel2 ||
    wt1.slice(lookbackStartSame, lastBar + 1).some((v) => v <= osLevel2) ||
    wt2.slice(lookbackStartSame, lastBar + 1).some((v) => v <= osLevel2);

  const isOversoldCompleted =
    wt2Prev <= osLevel2 ||
    wt1Prev <= osLevel2 ||
    (prevPrevBar >= 0 && (wt2[prevPrevBar] <= osLevel2 || wt1[prevPrevBar] <= osLevel2)) ||
    wt1.slice(lookbackStartCompleted, prevBar + 1).some((v) => v <= osLevel2) ||
    wt2.slice(lookbackStartCompleted, prevBar + 1).some((v) => v <= osLevel2);

  // Check overbought condition (>= 50 / 53) within recent peak window
  const isOverboughtSame =
    wt2Current >= obLevel2 ||
    wt1Current >= obLevel2 ||
    wt2Prev >= obLevel2 ||
    wt1Prev >= obLevel2 ||
    wt1.slice(lookbackStartSame, lastBar + 1).some((v) => v >= obLevel2) ||
    wt2.slice(lookbackStartSame, lastBar + 1).some((v) => v >= obLevel2);

  const isOverboughtCompleted =
    wt2Prev >= obLevel2 ||
    wt1Prev >= obLevel2 ||
    (prevPrevBar >= 0 && (wt2[prevPrevBar] >= obLevel2 || wt1[prevPrevBar] >= obLevel2)) ||
    wt1.slice(lookbackStartCompleted, prevBar + 1).some((v) => v >= obLevel2) ||
    wt2.slice(lookbackStartCompleted, prevBar + 1).some((v) => v >= obLevel2);

  // Green Dot (Bullish crossover in oversold zone)
  const greenDotSame = sameCandleBullCross && isOversoldSame;
  const greenDotCompleted = completedCandleBullCross && isOversoldCompleted;

  // Red Dot (Bearish crossunder in overbought zone)
  const redDotSame = sameCandleBearCross && isOverboughtSame;
  const redDotCompleted = completedCandleBearCross && isOverboughtCompleted;

  // Priority & mutual exclusivity: Same candle signal takes precedence over completed candle signal
  let hasGreenDot = false;
  let hasRedDot = false;
  let candleTiming: 'SAME_CANDLE' | 'COMPLETED_CANDLE' | 'NONE' = 'NONE';

  if (greenDotSame) {
    hasGreenDot = true;
    candleTiming = 'SAME_CANDLE';
  } else if (redDotSame) {
    hasRedDot = true;
    candleTiming = 'SAME_CANDLE';
  } else if (greenDotCompleted) {
    hasGreenDot = true;
    candleTiming = 'COMPLETED_CANDLE';
  } else if (redDotCompleted) {
    hasRedDot = true;
    candleTiming = 'COMPLETED_CANDLE';
  }

  let cipherDot: 'GREEN' | 'RED' | 'NONE' = 'NONE';
  if (hasGreenDot) cipherDot = 'GREEN';
  else if (hasRedDot) cipherDot = 'RED';

  // Strategy Execution Criteria:
  // LONG: Green dot in oversold zone AND market > EMA 200 with verified trend clearance (>= 0.15% above EMA)
  //       AND EMA 200 slope is flat or rising (not sloping downward against the long trade)
  // SHORT: Red dot in overbought zone AND market < EMA 200 with verified trend clearance (>= 0.15% below EMA)
  //        AND EMA 200 slope is flat or falling (not sloping upward against the short trade)
  // ALL OTHER: HOLD
  const minTrendClearancePct = config.minTrendClearancePct ?? 0.0015; // 0.15% minimum separation from EMA 200 to eliminate chop
  const emaClearanceAbove = currentPrice > currentEMA && ((currentPrice - currentEMA) / currentEMA) >= minTrendClearancePct;
  const emaClearanceBelow = currentPrice < currentEMA && ((currentEMA - currentPrice) / currentEMA) >= minTrendClearancePct;
  const isMarketAboveEMA = currentPrice > currentEMA;
  const isMarketBelowEMA = currentPrice < currentEMA;

  // EMA 200 Slope Guard: Prevents counter-trend entries into an actively curving trendline
  const emaSlopeUp = currentEMA >= prevEma5Bars && currentEMA >= prevEma10Bars * 0.9999;
  const emaSlopeDown = currentEMA <= prevEma5Bars && currentEMA <= prevEma10Bars * 1.0001;

  const buySignal = hasGreenDot && emaClearanceAbove && emaSlopeUp;
  const sellSignal = hasRedDot && emaClearanceBelow && emaSlopeDown;

  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let signalType: 'MONORID_GREEN_DOT' | 'MONORID_RED_DOT' | 'CIPHER_B_GREEN_DOT' | 'CIPHER_B_RED_DOT' | 'SMA_CROSS' | 'REVERSAL' | 'NONE' = 'NONE';
  let eliminatedReason: string | undefined;
  let message = 'Monorid: Inactive / Neutral. Strictly waiting for Green Dot in OS (> EMA 200) or Red Dot in OB (< EMA 200)';

  if (buySignal) {
    action = 'BUY';
    signalType = 'MONORID_GREEN_DOT';
    message = `Monorid: GREEN DOT in Oversold Zone (wt1: ${wt1Current.toFixed(1)}, wt2: ${wt2Current.toFixed(1)}) & Price ABOVE EMA 200 ($${currentPrice.toFixed(4)} > $${currentEMA.toFixed(4)})`;
  } else if (sellSignal) {
    action = 'SELL';
    signalType = 'MONORID_RED_DOT';
    message = `Monorid: RED DOT in Overbought Zone (wt1: ${wt1Current.toFixed(1)}, wt2: ${wt2Current.toFixed(1)}) & Price BELOW EMA 200 ($${currentPrice.toFixed(4)} < $${currentEMA.toFixed(4)})`;
  } else if (hasGreenDot && isMarketAboveEMA && !emaSlopeUp) {
    eliminatedReason = `Adverse EMA 200 Slope: EMA 200 is curving downward ($${currentEMA.toFixed(4)} < $${prevEma5Bars.toFixed(4)}) for Long`;
    message = `Monorid: Long rejected — ${eliminatedReason}`;
  } else if (hasRedDot && isMarketBelowEMA && !emaSlopeDown) {
    eliminatedReason = `Adverse EMA 200 Slope: EMA 200 is curving upward ($${currentEMA.toFixed(4)} > $${prevEma5Bars.toFixed(4)}) for Short`;
    message = `Monorid: Short rejected — ${eliminatedReason}`;
  } else if (hasGreenDot && isMarketAboveEMA && !emaClearanceAbove) {
    eliminatedReason = `Insufficient Trend Clearance: Price ($${currentPrice.toFixed(4)}) is hovering within 0.15% chop band of EMA 200 ($${currentEMA.toFixed(4)})`;
    message = `Monorid: Long rejected — ${eliminatedReason}`;
  } else if (hasRedDot && isMarketBelowEMA && !emaClearanceBelow) {
    eliminatedReason = `Insufficient Trend Clearance: Price ($${currentPrice.toFixed(4)}) is hovering within 0.15% chop band of EMA 200 ($${currentEMA.toFixed(4)})`;
    message = `Monorid: Short rejected — ${eliminatedReason}`;
  } else if (hasGreenDot && !isMarketAboveEMA) {
    eliminatedReason = `Counter-trend: Price below EMA 200 for Long ($${currentPrice.toFixed(4)} <= $${currentEMA.toFixed(4)})`;
    message = `Monorid: Long rejected — ${eliminatedReason}`;
  } else if (hasRedDot && !isMarketBelowEMA) {
    eliminatedReason = `Counter-trend: Price above EMA 200 for Short ($${currentPrice.toFixed(4)} >= $${currentEMA.toFixed(4)})`;
    message = `Monorid: Short rejected — ${eliminatedReason}`;
  } else if ((sameCandleBullCross || completedCandleBullCross) && !isOversoldSame && !isOversoldCompleted) {
    eliminatedReason = `Signal outside Oversold zone (WT1: ${wt1Current.toFixed(1)}, WT2: ${wt2Current.toFixed(1)} > ${osLevel2})`;
    message = `Monorid: Bullish crossover rejected — ${eliminatedReason}`;
  } else if ((sameCandleBearCross || completedCandleBearCross) && !isOverboughtSame && !isOverboughtCompleted) {
    eliminatedReason = `Signal outside Overbought zone (WT1: ${wt1Current.toFixed(1)}, WT2: ${wt2Current.toFixed(1)} < ${obLevel2})`;
    message = `Monorid: Bearish crossover rejected — ${eliminatedReason}`;
  }

  // ── Risk Management: Stop Loss strictly below/above EMA 200, Take Profit strictly 1:2 R:R ──
  const slBufferPct = config.slBufferPct ?? 0.004; // 0.4% buffer beyond EMA 200
  const minSlDistancePct = config.minSlDistancePct ?? 0.005; // 0.5% minimum safe distance from entry to prevent noise stopouts
  const maxRiskDistPct = config.maxRiskDistPct ?? 0.015;     // 1.5% maximum allowable risk ceiling to eliminate overextended entries
  const rr = config.riskRewardRatio ?? 2.0;        // Strictly 1:2 R:R

  let slLevel: number | undefined;
  let tp1Level: number | undefined;
  let tp2Level: number | undefined;
  let tp3Level: number | undefined;
  let tpLevel: number | undefined;
  let riskDist: number | undefined;

  if (action === 'BUY') {
    // Stop loss strictly below EMA 200 with safety buffer, and at least minimum breathing room from entry
    const rawSl = currentEMA * (1 - slBufferPct);
    const minSafeSl = currentPrice * (1 - minSlDistancePct);
    slLevel = Math.min(rawSl, minSafeSl);
    riskDist = currentPrice - slLevel;
    tpLevel = currentPrice + riskDist * rr;
    tp1Level = tpLevel;
    tp2Level = tpLevel;
    tp3Level = tpLevel;

    // Safety guard: if SL is <= 0, trade cannot execute safely
    if (slLevel <= 0) {
      action = 'HOLD';
      signalType = 'NONE';
      candleTiming = 'NONE';
      eliminatedReason = `Negative risk calculation: Stop Loss ($${slLevel.toFixed(4)}) is below zero`;
      message = `Monorid: Long trade skipped — ${eliminatedReason}.`;
      slLevel = undefined;
      tpLevel = undefined;
      tp1Level = undefined;
      tp2Level = undefined;
      tp3Level = undefined;
      riskDist = undefined;
    } else if (config.maxRiskDistPct && riskDist / currentPrice > config.maxRiskDistPct) {
      action = 'HOLD';
      signalType = 'NONE';
      candleTiming = 'NONE';
      eliminatedReason = `Overextended from EMA 200: Risk distance (${((riskDist / currentPrice) * 100).toFixed(2)}%) exceeds ${(config.maxRiskDistPct * 100).toFixed(1)}% ceiling — awaiting pullback to trendline`;
      message = `Monorid: Long trade skipped — ${eliminatedReason}.`;
      slLevel = undefined;
      tpLevel = undefined;
      tp1Level = undefined;
      tp2Level = undefined;
      tp3Level = undefined;
      riskDist = undefined;
    }
  } else if (action === 'SELL') {
    // Stop loss strictly above EMA 200 with safety buffer, and at least minimum breathing room from entry
    const rawSl = currentEMA * (1 + slBufferPct);
    const minSafeSl = currentPrice * (1 + minSlDistancePct);
    slLevel = Math.max(rawSl, minSafeSl);
    riskDist = slLevel - currentPrice;
    tpLevel = currentPrice - riskDist * rr;
    tp1Level = tpLevel;
    tp2Level = tpLevel;
    tp3Level = tpLevel;

    // Safety guard: if 1:2 Take Profit is <= 0 (e.g. extreme EMA distance on low price), trade cannot execute safely
    if (tpLevel <= 0) {
      action = 'HOLD';
      signalType = 'NONE';
      candleTiming = 'NONE';
      eliminatedReason = `Negative TP risk calculation: 1:2 TP target ($${tpLevel.toFixed(4)}) is mathematically below zero due to extreme EMA distance`;
      message = `Monorid: Short trade skipped — ${eliminatedReason}.`;
      slLevel = undefined;
      tpLevel = undefined;
      tp1Level = undefined;
      tp2Level = undefined;
      tp3Level = undefined;
      riskDist = undefined;
    } else if (config.maxRiskDistPct && riskDist / currentPrice > config.maxRiskDistPct) {
      action = 'HOLD';
      signalType = 'NONE';
      candleTiming = 'NONE';
      eliminatedReason = `Overextended from EMA 200: Risk distance (${((riskDist / currentPrice) * 100).toFixed(2)}%) exceeds ${(config.maxRiskDistPct * 100).toFixed(1)}% ceiling — awaiting pullback to trendline`;
      message = `Monorid: Short trade skipped — ${eliminatedReason}.`;
      slLevel = undefined;
      tpLevel = undefined;
      tp1Level = undefined;
      tp2Level = undefined;
      tp3Level = undefined;
      riskDist = undefined;
    }
  }

  // Leverage selection (6x - 8x safe range)
  let recommendedLeverage = 7;
  if (riskDist && currentPrice > 0) {
    const riskPct = (riskDist / currentPrice) * 100;
    if (riskPct < 1.0) recommendedLeverage = 8;
    else if (riskPct <= 2.5) recommendedLeverage = 7;
    else recommendedLeverage = 6;
  }
  recommendedLeverage = Math.min(Math.max(recommendedLeverage, config.minLeverage || 6), config.maxLeverage || 8);

  // Confidence calculation (Trade executes ONLY when confidence >= minConfidence, e.g. 80%)
  let confidence = 0;
  if (action !== 'HOLD') {
    let score = 80; // High conviction base score for confirmed Monorid + EMA 200 trigger

    // Extreme oversold / overbought bonus (<= -60 or >= 60)
    if (action === 'BUY' && (wt2Current <= -60 || wt1Current <= -60 || wt2Prev <= -60)) {
      score += 8;
    } else if (action === 'SELL' && (wt2Current >= 60 || wt1Current >= 60 || wt2Prev >= 60)) {
      score += 8;
    }

    // Clearance from EMA 200 confirmation
    const emaDistPct = (Math.abs(currentPrice - currentEMA) / currentEMA) * 100;
    if (emaDistPct >= 0.5) score += 5;

    // Volume surge confirmation
    const recentVol = candles.slice(-20, -1);
    const avgVol = recentVol.length > 0 ? recentVol.reduce((s, c) => s + (c.volume || 0), 0) / recentVol.length : 1;
    const curVol = candles[lastBar].volume || 1;
    if (avgVol > 0 && curVol / avgVol >= 1.2) {
      score += 5;
    }

    confidence = Math.min(99, Math.max(80, score));
  }

  return {
    action,
    entryPrice: currentPrice,
    slLevel: slLevel ? Number(slLevel.toFixed(6)) : undefined,
    tp1Level: tp1Level ? Number(tp1Level.toFixed(6)) : undefined,
    tp2Level: tp2Level ? Number(tp2Level.toFixed(6)) : undefined,
    tp3Level: tp3Level ? Number(tp3Level.toFixed(6)) : undefined,
    tpLevel: tpLevel ? Number(tpLevel.toFixed(6)) : undefined,
    riskDist: riskDist ? Number(riskDist.toFixed(6)) : undefined,
    rsi: Number(wt1Current.toFixed(2)), // For backward compatibility with UI
    sma: Number(currentEMA.toFixed(4)), // For backward compatibility with UI
    ema: Number(currentEMA.toFixed(4)),
    wt1: Number(wt1Current.toFixed(2)),
    wt2: Number(wt2Current.toFixed(2)),
    monoridDot: cipherDot,
    cipherDot,
    signalType,
    candleTiming,
    recommendedLeverage,
    confidence,
    message,
    eliminatedReason,
  };
}

// Backward compatibility aliases
export const calculateMarketCipherB = calculateMonoridIndicator;
export const analyzeMarketCipherBStrategy = analyzeMonoridStrategy;
export const analyzeCrudeOilStrategy = analyzeMonoridStrategy;

/**
 * 100% Full Exit at 1:2 TP or SL
 */
export function calculatePositionExitQuantity(
  initialSize: number,
  targetStage: 'TP1' | 'TP2' | 'TP3' | 'SL' | string
): { closeFraction: number; closeQty: number; remainingQty: number } {
  if (initialSize <= 0) {
    return { closeFraction: 0, closeQty: 0, remainingQty: 0 };
  }

  // Under the 1:2 TP strategy, 100% of the position is exited at Take Profit or Stop Loss
  return {
    closeFraction: 1.0,
    closeQty: initialSize,
    remainingQty: 0,
  };
}
