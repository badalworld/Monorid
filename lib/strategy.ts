/**
 * MONORID ALGORITHMIC TRADING CORE
 * Developed by Trading Lifestyle Quant
 * Institutional Liquidity Sweep & Futures Execution Engine
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Pool {
  id: string;
  level: number;
  bornBar: number;
  isHigh: boolean;
}

export interface PendingSweep {
  level: number;
  wickExtreme: number;
  breakBar: number;
  raidRange: number;
  isHigh: boolean;
}

export interface StrategyConfig {
  pivotLen: number; // default 8
  confirmWindow: number; // default 3
  maxPools: number; // default 12
  minWickPct: number; // default 25
  useVolFilter: boolean; // default true
  volLen: number; // default 20
  volMultReq: number; // default 1.1
  tpAtrPeriod: number; // default 14
  slAtrMult: number; // default 1.5
  slPercent: number; // default 1.0
  useAtrSl: boolean; // default true
  rrTp1: number; // default 1.0
  rrTp2: number; // default 2.0
  rrTp3: number; // default 3.0
  equityRiskPct: number; // default 10%
  minLeverage: number; // 10
  maxLeverage: number; // 15
}

export const DEFAULT_CONFIG: StrategyConfig = {
  pivotLen: 8,
  confirmWindow: 3,
  maxPools: 12,
  minWickPct: 25,
  useVolFilter: true,
  volLen: 20,
  volMultReq: 1.1,
  tpAtrPeriod: 14,
  slAtrMult: 1.5,
  slPercent: 1.0,
  useAtrSl: true,
  rrTp1: 1.0,
  rrTp2: 2.0,
  rrTp3: 3.0,
  equityRiskPct: 10,
  minLeverage: 10,
  maxLeverage: 15,
};

export interface SignalResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  sweepLevel?: number;
  sweepWick?: number;
  entryPrice?: number;
  slLevel?: number;
  tp1Level?: number;
  tp2Level?: number;
  tp3Level?: number;
  riskDist?: number;
  volMultiplier: number;
  volOK: boolean;
  atr: number;
  highPoolsCount: number;
  lowPoolsCount: number;
  nearestAbove?: number;
  nearestBelow?: number;
  distAboveAtr?: number;
  distBelowAtr?: number;
  pendingSweepText: string;
  recommendedLeverage: number;
}

/**
 * Calculates Simple Moving Average
 */
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

/**
 * Calculates Average True Range (Wilder's ATR)
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
    } else {
      const prevClose = candles[i - 1].close;
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevClose),
        Math.abs(candles[i].low - prevClose)
      );
      trs.push(tr);
    }
  }

  const atr: number[] = new Array(candles.length).fill(0);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      sum += trs[i];
      atr[i] = sum / (i + 1);
    } else if (i === period) {
      sum += trs[i];
      atr[i] = sum / period;
    } else {
      atr[i] = (atr[i - 1] * (period - 1) + trs[i]) / period;
    }
  }
  return atr;
}

/**
 * Detects swing highs and swing lows matching TradingView ta.pivothigh / ta.pivotlow
 */
export function isPivotHigh(highs: number[], index: number, left: number, right: number): boolean {
  if (index < left || index + right >= highs.length) return false;
  const target = highs[index];
  for (let i = index - left; i <= index + right; i++) {
    if (i !== index && highs[i] >= target) {
      return false;
    }
  }
  return true;
}

export function isPivotLow(lows: number[], index: number, left: number, right: number): boolean {
  if (index < left || index + right >= lows.length) return false;
  const target = lows[index];
  for (let i = index - left; i <= index + right; i++) {
    if (i !== index && lows[i] <= target) {
      return false;
    }
  }
  return true;
}

/**
 * Analyzes market series using Monorid Liquidity Raid quant logic
 */
export function analyzeLiquidityReaper(
  candles: Candle[],
  config: StrategyConfig = DEFAULT_CONFIG
): SignalResult {
  if (candles.length < config.pivotLen * 2 + 5) {
    return {
      action: 'HOLD',
      volMultiplier: 1.0,
      volOK: false,
      atr: 0,
      highPoolsCount: 0,
      lowPoolsCount: 0,
      pendingSweepText: 'Insufficient bars',
      recommendedLeverage: config.minLeverage,
    };
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const atrSeries = calculateATR(candles, config.tpAtrPeriod);
  const volMASeries = calculateSMA(volumes, config.volLen);

  const highPools: Pool[] = [];
  const lowPools: Pool[] = [];
  let pendHigh: PendingSweep | null = null;
  let pendLow: PendingSweep | null = null;

  let latestSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let sweepLvlSell: number | undefined;
  let sweepWickSell: number | undefined;
  let sweepLvlBuy: number | undefined;
  let sweepWickBuy: number | undefined;

  // Process bar by bar to mirror real-time Pine execution
  for (let bar = config.pivotLen; bar < candles.length; bar++) {
    // 1. Pivot registration (at bar - pivotLen)
    const testPivotBar = bar - config.pivotLen;
    if (testPivotBar >= config.pivotLen) {
      if (isPivotHigh(highs, testPivotBar, config.pivotLen, config.pivotLen)) {
        highPools.push({
          id: `H_${testPivotBar}`,
          level: highs[testPivotBar],
          bornBar: testPivotBar,
          isHigh: true,
        });
        if (highPools.length > config.maxPools) {
          highPools.shift();
        }
      }

      if (isPivotLow(lows, testPivotBar, config.pivotLen, config.pivotLen)) {
        lowPools.push({
          id: `L_${testPivotBar}`,
          level: lows[testPivotBar],
          bornBar: testPivotBar,
          isHigh: false,
        });
        if (lowPools.length > config.maxPools) {
          lowPools.shift();
        }
      }
    }

    // 2. Detect Raids intrabar
    const currHigh = highs[bar];
    const currLow = lows[bar];
    const raidRange = Math.max(currHigh - currLow, 0.00000001);

    // High side raid check
    for (let i = highPools.length - 1; i >= 0; i--) {
      if (currHigh > highPools[i].level) {
        pendHigh = {
          level: highPools[i].level,
          wickExtreme: currHigh,
          breakBar: bar,
          raidRange,
          isHigh: true,
        };
        highPools.splice(i, 1);
        break;
      }
    }

    // Low side raid check
    for (let i = lowPools.length - 1; i >= 0; i--) {
      if (currLow < lowPools[i].level) {
        pendLow = {
          level: lowPools[i].level,
          wickExtreme: currLow,
          breakBar: bar,
          raidRange,
          isHigh: false,
        };
        lowPools.splice(i, 1);
        break;
      }
    }

    // Track wick extremes
    if (pendHigh) {
      pendHigh.wickExtreme = Math.max(pendHigh.wickExtreme, currHigh);
    }
    if (pendLow) {
      pendLow.wickExtreme = Math.min(pendLow.wickExtreme, currLow);
    }

    // Reset signal on each bar
    let barSellSignal = false;
    let barBuySignal = false;

    const currVol = volumes[bar];
    const currVolMA = volMASeries[bar];
    const volMult = currVolMA > 0 ? currVol / currVolMA : 1.0;
    const volOK = !config.useVolFilter || volMult >= config.volMultReq;

    // Confirm sweeps
    if (pendHigh) {
      const elapsed = bar - pendHigh.breakBar;
      const wickPct = ((pendHigh.wickExtreme - pendHigh.level) / pendHigh.raidRange) * 100;
      const wickOK = wickPct >= config.minWickPct;

      if (elapsed >= 1 && elapsed <= config.confirmWindow) {
        if (closes[bar] < pendHigh.level && closes[bar] < candles[bar].open && volOK && wickOK) {
          barSellSignal = true;
          sweepLvlSell = pendHigh.level;
          sweepWickSell = pendHigh.wickExtreme;
          pendHigh = null;
        }
      } else if (elapsed > config.confirmWindow) {
        pendHigh = null;
      }
    }

    if (pendLow) {
      const elapsed = bar - pendLow.breakBar;
      const wickPct = ((pendLow.level - pendLow.wickExtreme) / pendLow.raidRange) * 100;
      const wickOK = wickPct >= config.minWickPct;

      if (elapsed >= 1 && elapsed <= config.confirmWindow) {
        if (closes[bar] > pendLow.level && closes[bar] > candles[bar].open && volOK && wickOK) {
          barBuySignal = true;
          sweepLvlBuy = pendLow.level;
          sweepWickBuy = pendLow.wickExtreme;
          pendLow = null;
        }
      } else if (elapsed > config.confirmWindow) {
        pendLow = null;
      }
    }

    if (barBuySignal) latestSignal = 'BUY';
    else if (barSellSignal) latestSignal = 'SELL';
    else latestSignal = 'HOLD';
  }

  // Final bar calculations
  const lastBar = candles.length - 1;
  const currentPrice = closes[lastBar];
  const lastAtr = atrSeries[lastBar] || currentPrice * 0.01;
  const lastVol = volumes[lastBar];
  const lastVolMA = volMASeries[lastBar] || 1;
  const volMultiplier = lastVolMA > 0 ? lastVol / lastVolMA : 1.0;
  const volOK = !config.useVolFilter || volMultiplier >= config.volMultReq;

  // Nearest pools
  let nearestAbove: number | undefined;
  for (const p of highPools) {
    if (p.level > currentPrice && (nearestAbove === undefined || p.level < nearestAbove)) {
      nearestAbove = p.level;
    }
  }

  let nearestBelow: number | undefined;
  for (const p of lowPools) {
    if (p.level < currentPrice && (nearestBelow === undefined || p.level > nearestBelow)) {
      nearestBelow = p.level;
    }
  }

  const distAboveAtr = nearestAbove && lastAtr > 0 ? (nearestAbove - currentPrice) / lastAtr : undefined;
  const distBelowAtr = nearestBelow && lastAtr > 0 ? (currentPrice - nearestBelow) / lastAtr : undefined;

  // Adaptive leverage based on ATR volatility:
  // Low volatility assets can support 15x, higher volatility scaled to 10x-12x
  const atrPct = (lastAtr / currentPrice) * 100;
  let recommendedLeverage = 12;
  if (atrPct < 0.8) recommendedLeverage = 15;
  else if (atrPct > 2.0) recommendedLeverage = 10;
  else recommendedLeverage = 12;

  // Risk dist calculation
  const riskDist = config.useAtrSl ? lastAtr * config.slAtrMult : currentPrice * (config.slPercent / 100);

  let slLevel: number | undefined;
  let tp1Level: number | undefined;
  let tp2Level: number | undefined;
  let tp3Level: number | undefined;

  if (latestSignal === 'BUY') {
    slLevel = currentPrice - riskDist;
    tp1Level = currentPrice + riskDist * config.rrTp1;
    tp2Level = currentPrice + riskDist * config.rrTp2;
    tp3Level = currentPrice + riskDist * config.rrTp3;
  } else if (latestSignal === 'SELL') {
    slLevel = currentPrice + riskDist;
    tp1Level = currentPrice - riskDist * config.rrTp1;
    tp2Level = currentPrice - riskDist * config.rrTp2;
    tp3Level = currentPrice - riskDist * config.rrTp3;
  }

  const pendingSweepText = pendHigh
    ? 'High-side raid live (Sell Pending)'
    : pendLow
    ? 'Low-side raid live (Buy Pending)'
    : 'None active';

  return {
    action: latestSignal,
    sweepLevel: latestSignal === 'BUY' ? sweepLvlBuy : sweepLvlSell,
    sweepWick: latestSignal === 'BUY' ? sweepWickBuy : sweepWickSell,
    entryPrice: currentPrice,
    slLevel,
    tp1Level,
    tp2Level,
    tp3Level,
    riskDist,
    volMultiplier: Number(volMultiplier.toFixed(2)),
    volOK,
    atr: Number(lastAtr.toFixed(4)),
    highPoolsCount: highPools.length,
    lowPoolsCount: lowPools.length,
    nearestAbove,
    nearestBelow,
    distAboveAtr: distAboveAtr ? Number(distAboveAtr.toFixed(2)) : undefined,
    distBelowAtr: distBelowAtr ? Number(distBelowAtr.toFixed(2)) : undefined,
    pendingSweepText,
    recommendedLeverage,
  };
}

/**
 * Calculates Partial TP Execution breakdown:
 * When TP1 hit: 25% closed
 * When TP2 hit: 50% closed
 * When TP3 hit: 100% closed (remaining)
 */
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
    // 50% of original total size closed at TP2
    const closeQty = initialSize * 0.5;
    return {
      closeFraction: 0.5,
      closeQty,
      remainingQty: initialSize * 0.25, // remaining for TP3
    };
  }
  if (targetStage === 'TP3' || targetStage === 'SL') {
    // Full close of remaining
    return {
      closeFraction: 1.0,
      closeQty: initialSize,
      remainingQty: 0,
    };
  }
  return { closeFraction: 0, closeQty: 0, remainingQty: initialSize };
}
