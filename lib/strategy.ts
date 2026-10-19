/**
 * MONORID ALGORITHMIC TRADING CORE
 * Developed by Trading Lifestyle Quant
 * CRUDE OIL BUY/SELL Strategy with EMA 200 Trend Filter
 * Based on Pine Script by nicks1008 (MPL 2.0)
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
  smaLength: number;
  rsiLength: number;
  rsiHigher: number;
  rsiLower: number;
  emaLength: number;
  distSMA: number;
  candleLength: number;
  rrTp1: number;
  rrTp2: number;
  rrTp3: number;
  equityRiskPct: number;
  minLeverage: number;
  maxLeverage: number;
}

export const DEFAULT_CONFIG: StrategyConfig = {
  smaLength: 70,
  rsiLength: 14,
  rsiHigher: 80,
  rsiLower: 20,
  emaLength: 200,
  distSMA: 1,
  candleLength: 1,
  rrTp1: 1.0,
  rrTp2: 2.0,
  rrTp3: 3.0,
  equityRiskPct: 10,
  minLeverage: 10,
  maxLeverage: 15,
};

export interface SignalResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  entryPrice?: number;
  slLevel?: number;
  tp1Level?: number;
  tp2Level?: number;
  tp3Level?: number;
  riskDist?: number;
  rsi: number;
  sma: number;
  ema: number;
  emaFilterOK: boolean;
  signalType: 'SMA_CROSS' | 'REVERSAL' | 'NONE';
  recommendedLeverage: number;
  message: string;
}

export function calculateSMA(data: number[], length: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    if (i < length - 1) {
      const slice = data.slice(0, i + 1);
      result[i] = slice.reduce((a, b) => a + b, 0) / slice.length;
    } else {
      let sum = 0;
      for (let j = 0; j < length; j++) {
        sum += data[i - j];
      }
      result[i] = sum / length;
    }
  }
  return result;
}

export function calculateEMA(data: number[], length: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  const multiplier = 2 / (length + 1);
  
  let sum = 0;
  for (let i = 0; i < Math.min(length, data.length); i++) {
    sum += data[i];
    result[i] = sum / (i + 1);
  }
  
  for (let i = length; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
  }
  
  return result;
}

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

export function analyzeCrudeOilStrategy(
  candles: Candle[],
  config: StrategyConfig = DEFAULT_CONFIG
): SignalResult {
  const minBars = Math.max(config.smaLength, 70) + 5;
  
  if (candles.length < minBars) {
    return {
      action: 'HOLD',
      rsi: 50,
      sma: 0,
      ema: 0,
      emaFilterOK: false,
      signalType: 'NONE',
      recommendedLeverage: config.minLeverage,
      message: `Insufficient bars (${candles.length}/${minBars})`,
    };
  }
  
  const closes = candles.map((c) => c.close);
  const opens = candles.map((c) => c.open);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  
  const smaSeries = calculateSMA(closes, config.smaLength);
  const emaSeries = calculateEMA(closes, config.emaLength);
  const rsiSeries = calculateRSI(closes, config.rsiLength);
  
  const lastBar = candles.length - 1;
  const prevBar = lastBar - 1;
  
  const currentPrice = closes[lastBar];
  const currentOpen = opens[lastBar];
  const currentHigh = highs[lastBar];
  const currentLow = lows[lastBar];
  const currentClose = closes[lastBar];
  
  const prevClose = closes[prevBar];
  const prevOpen = opens[prevBar];
  const prevHigh = highs[prevBar];
  const prevLow = lows[prevBar];
  
  const currentSMA = smaSeries[lastBar];
  const prevSMA = smaSeries[prevBar];
  const currentEMA = emaSeries[lastBar];
  const currentRSI = rsiSeries[lastBar];

  const isBullishCandle = currentOpen < currentClose;
  const isBearishCandle = currentOpen > currentClose;
  const candleRange = currentHigh - currentLow;
  
  // BUY signal: crossover(close[1], sma1) and close[1] > open[1] and high[0] > high[1] and close[0] > open[0]
  const buySignal = prevClose > prevSMA && 
                    currentClose > currentSMA &&
                    prevClose > prevOpen &&
                    currentHigh > prevHigh &&
                    isBullishCandle;
  
  // SELL signal: crossunder(low[1], sma1) and close[1] < open[1] and low[0] < low[1] and close[0] < open[0]
  const sellSignal = prevLow < prevSMA &&
                     currentLow < currentSMA &&
                     prevClose < prevOpen &&
                     currentLow < prevLow &&
                     isBearishCandle;
  
  // EMA 200 trend filter
  const emaFilterOK_BUY = currentPrice > currentEMA;
  const emaFilterOK_SELL = currentPrice < currentEMA;
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let signalType: 'SMA_CROSS' | 'REVERSAL' | 'NONE' = 'NONE';
  let message = 'No signal';
  
  if (buySignal && emaFilterOK_BUY) {
    action = 'BUY';
    signalType = 'SMA_CROSS';
    message = `BUY signal: Price crossed above SMA ${config.smaLength}, above EMA ${config.emaLength}`;
  } else if (sellSignal && emaFilterOK_SELL) {
    action = 'SELL';
    signalType = 'SMA_CROSS';
    message = `SELL signal: Price crossed below SMA ${config.smaLength}, below EMA ${config.emaLength}`;
  } else if (buySignal && !emaFilterOK_BUY) {
    message = `BUY signal skipped: Price below EMA ${config.emaLength} (trend filter)`;
  } else if (sellSignal && !emaFilterOK_SELL) {
    message = `SELL signal skipped: Price above EMA ${config.emaLength} (trend filter)`;
  }
  
  // Calculate ATR for risk management (most recent bars only)
  const atrPeriod = 14;
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
    } else {
      const prevC = candles[i - 1].close;
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevC),
        Math.abs(candles[i].low - prevC)
      );
      trs.push(tr);
    }
  }

  const recentTrs = trs.slice(-atrPeriod);
  const atr = recentTrs.reduce((sum, tr) => sum + tr, 0) / recentTrs.length;
  
  const riskDist = atr * 1.5;
  
  let slLevel: number | undefined;
  let tp1Level: number | undefined;
  let tp2Level: number | undefined;
  let tp3Level: number | undefined;
  
  if (action === 'BUY') {
    slLevel = currentPrice - riskDist;
    tp1Level = currentPrice + riskDist * config.rrTp1;
    tp2Level = currentPrice + riskDist * config.rrTp2;
    tp3Level = currentPrice + riskDist * config.rrTp3;
  } else if (action === 'SELL') {
    slLevel = currentPrice + riskDist;
    tp1Level = currentPrice - riskDist * config.rrTp1;
    tp2Level = currentPrice - riskDist * config.rrTp2;
    tp3Level = currentPrice - riskDist * config.rrTp3;
  }
  
  const atrPct = (atr / currentPrice) * 100;
  let recommendedLeverage = 12;
  if (atrPct < 0.8) recommendedLeverage = 15;
  else if (atrPct > 2.0) recommendedLeverage = 10;
  
  return {
    action,
    entryPrice: currentPrice,
    slLevel,
    tp1Level,
    tp2Level,
    tp3Level,
    riskDist,
    rsi: Number(currentRSI.toFixed(2)),
    sma: Number(currentSMA.toFixed(4)),
    ema: Number(currentEMA.toFixed(4)),
    emaFilterOK: action !== 'HOLD',
    signalType,
    recommendedLeverage,
    message,
  };
}

export function calculatePositionExitQuantity(
  initialSize: number,
  targetStage: 'TP1' | 'TP2' | 'TP3' | 'SL'
): { closeFraction: number; closeQty: number; remainingQty: number } {
  if (targetStage === 'TP1') {
    const closeQty = initialSize * 0.25;
    return {
      closeFraction: 0.25,
      closeQty,
      remainingQty: initialSize - closeQty,
    };
  }
  if (targetStage === 'TP2') {
    const closeQty = initialSize * 0.5;
    return {
      closeFraction: 0.5,
      closeQty,
      remainingQty: initialSize * 0.25,
    };
  }
  if (targetStage === 'TP3' || targetStage === 'SL') {
    return {
      closeFraction: 1.0,
      closeQty: initialSize,
      remainingQty: 0,
    };
  }
  return { closeFraction: 0, closeQty: 0, remainingQty: initialSize };
}
