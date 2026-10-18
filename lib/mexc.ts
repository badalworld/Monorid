import crypto from 'crypto';
import { Candle, StrategyConfig, analyzeLiquidityReaper, DEFAULT_CONFIG } from './strategy';

export interface MexcTicker {
  symbol: string;
  lastPrice: number;
  riseFallRate: number; // e.g. 0.0825 for +8.25%
  volume24: number;
  amount24: number;
  high24Price: number;
  low24Price: number;
  fairPrice: number;
  fundingRate: number;
  volatilityScore: number;
  groupName: string;
  groupIndex: number;
}

export interface BotDefinition {
  id: string;
  code: string;
  name: string;
  strategy: string;
  assignedGroup: string;
  pnl: number;
  status: 'ACTIVE' | 'SCANNING' | 'HOLDING';
  currentSymbol?: string;
  tradesCount: number;
}

export const MAX_OPEN_POSITIONS = 8;

export const OFFICIAL_BOT_UNITS: BotDefinition[] = [
  { id: 'apex-momentum', code: 'APEX MOMENTUM', name: 'Apex Momentum', strategy: 'MOMENTUM', assignedGroup: 'Apex Cyber-Volatiles', pnl: 12.45, status: 'HOLDING', currentSymbol: 'BTC_USDT', tradesCount: 14 },
  { id: 'mean-reversion', code: 'MEAN REVERSION', name: 'Mean Reversion', strategy: 'MEAN REVERSION', assignedGroup: 'Titan Momentum Core', pnl: 7.21, status: 'ACTIVE', tradesCount: 9 },
  { id: 'breakout-hunter', code: 'BREAKOUT HUNTER', name: 'Breakout Hunter', strategy: 'BREAKOUT', assignedGroup: 'Quantum Velocity', pnl: 9.84, status: 'HOLDING', currentSymbol: 'SOL_USDT', tradesCount: 12 },
  { id: 'rapid-scalper', code: 'RAPID SCALPER', name: 'Rapid Scalper', strategy: 'SCALPING', assignedGroup: 'Alpha Rapid-Scalp', pnl: 5.32, status: 'ACTIVE', tradesCount: 18 },
  { id: 'swing-raider', code: 'SWING RAIDER', name: 'Swing Raider', strategy: 'SWING', assignedGroup: 'DeFi & Layer-1 Vanguard', pnl: 8.19, status: 'HOLDING', currentSymbol: 'SUI_USDT', tradesCount: 8 },
  { id: 'volatility-reaper', code: 'VOLATILITY REAPER', name: 'Volatility Reaper', strategy: 'VOLATILITY', assignedGroup: 'Apex Cyber-Volatiles', pnl: 3.17, status: 'ACTIVE', tradesCount: 7 },
  { id: 'liquidity-sweeper', code: 'LIQUIDITY SWEEPER', name: 'Liquidity Sweeper', strategy: 'LIQUIDITY RAID', assignedGroup: 'Quantum Velocity', pnl: 11.03, status: 'ACTIVE', tradesCount: 15 },
  { id: 'order-flow-reaper', code: 'ORDER FLOW REAPER', name: 'Order Flow Reaper', strategy: 'ORDER FLOW', assignedGroup: 'Alpha Rapid-Scalp', pnl: 6.71, status: 'ACTIVE', tradesCount: 11 },
];

export interface MexcPosition {
  id: string;
  symbol: string;
  groupName: string;
  botId: string;
  botCode: string;
  botName: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  initialSize: number; // Contract size or USDT value
  currentSize: number;
  equityUsed: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  slHit: boolean;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: number;
  closedAt?: number;
  closeReason?: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL';
  sweepDetails?: {
    volumeMult: number;
    atr: number;
    nearestPoolDistance: number;
  };
}

export interface TradeLog {
  id: string;
  timestamp: number;
  groupName: string;
  botCode?: string;
  botName?: string;
  symbol: string;
  type: 'SCAN_RAID' | 'ENTRY' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | 'TELEGRAM_DISPATCH';
  side: 'LONG' | 'SHORT' | 'INFO';
  price: number;
  sizeFraction?: string;
  pnl?: number;
  message: string;
  details?: Record<string, any>;
}

// Group naming definitions for 15 assets per group
export const ASSET_GROUPS = [
  { name: 'Apex Cyber-Volatiles', description: 'Top 15 highest volatility & 24h price momentum surge contracts' },
  { name: 'Titan Momentum Core', description: 'High-liquidity large cap breakout assets with elevated volume velocity' },
  { name: 'Quantum Velocity', description: 'High-beta momentum contracts with wide intraday ranges' },
  { name: 'DeFi & Layer-1 Vanguard', description: 'Fast-moving decentralized ecosystem and infrastructure runners' },
  { name: 'Alpha Rapid-Scalp', description: 'High-turnover volatile contracts ideal for 5-minute liquidity sweeps' },
];

/**
 * Generates MEXC Contract API HMAC-SHA256 signature
 */
export function generateMexcSignature(
  apiKey: string,
  secretKey: string,
  reqTime: number,
  paramStr: string = ''
): string {
  const message = `${apiKey}${reqTime}${paramStr}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

/**
 * Fetch raw tickers from MEXC Futures REST API
 */
export async function fetchMexcFuturesTickers(): Promise<MexcTicker[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://contract.mexc.com/api/v1/contract/ticker', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        // Filter USDT-M contracts
        const usdtContracts = data.data.filter((item: any) =>
          item.symbol && item.symbol.endsWith('_USDT') && item.volume24 > 100000
        );

        // Sort by highest absolute price change and volume volatility
        const sorted = usdtContracts.map((item: any) => {
          const riseFallRate = Number(item.riseFallRate) || 0;
          const high = Number(item.high24Price) || 0;
          const low = Number(item.low24Price) || 0;
          const last = Number(item.lastPrice) || 1;
          const rangePct = last > 0 ? ((high - low) / last) * 100 : 0;
          // Volatility score combining range % and absolute 24h change %
          const volatilityScore = Math.abs(riseFallRate * 100) * 1.5 + rangePct;

          return {
            symbol: item.symbol,
            lastPrice: last,
            riseFallRate: riseFallRate,
            volume24: Number(item.volume24) || 0,
            amount24: Number(item.amount24) || 0,
            high24Price: high,
            low24Price: low,
            fairPrice: Number(item.fairPrice) || last,
            fundingRate: Number(item.fundingRate) || 0,
            volatilityScore,
            groupName: '',
            groupIndex: 0,
          };
        });

        sorted.sort((a: any, b: any) => b.volatilityScore - a.volatilityScore);

        // Partition into groups of 15 assets each
        const groupedTickers: MexcTicker[] = [];
        const groupSize = 15;

        for (let g = 0; g < ASSET_GROUPS.length; g++) {
          const groupName = ASSET_GROUPS[g].name;
          const slice = sorted.slice(g * groupSize, (g + 1) * groupSize);
          for (const item of slice) {
            groupedTickers.push({
              ...item,
              groupName,
              groupIndex: g,
            });
          }
        }

        if (groupedTickers.length >= 15) {
          return groupedTickers;
        }
      }
    }
  } catch (err) {
    console.warn('[MEXC API] Fallback to curated volatile market assets due to network timeout or rate limit:', err);
  }

  // Curated High-Volatility MEXC USDT-M perpetuals pool if public endpoint times out
  return generateCuratedMarketData();
}

/**
 * Fetch 5m candles for a specific contract from MEXC API
 */
export async function fetchMexcKlines(symbol: string, limit: number = 60): Promise<Candle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // MEXC Futures kline endpoint: interval=Min5
    const res = await fetch(`https://contract.mexc.com/api/v1/contract/kline/${symbol}?interval=Min5`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.data && Array.isArray(data.data.time)) {
        const candles: Candle[] = [];
        const times = data.data.time;
        const opens = data.data.open;
        const highs = data.data.high;
        const lows = data.data.low;
        const closes = data.data.close;
        const vols = data.data.vol;

        const count = times.length;
        const start = Math.max(0, count - limit);

        for (let i = start; i < count; i++) {
          candles.push({
            timestamp: times[i] * 1000,
            open: Number(opens[i]),
            high: Number(highs[i]),
            low: Number(lows[i]),
            close: Number(closes[i]),
            volume: Number(vols[i]),
          });
        }
        if (candles.length > 20) return candles;
      }
    }
  } catch (err) {
    // handled by generator below
  }

  // High-fidelity synthetic fallback klines aligned to current price
  return generateSyntheticKlines(symbol, limit);
}

/**
 * Curated high-volatility futures contracts divided in 5 groups of 15 assets (75 total assets)
 */
export function generateCuratedMarketData(): MexcTicker[] {
  const assetPool = [
    // Group 1: Apex Cyber-Volatiles (Top 15 runners)
    { s: 'PEPE_USDT', p: 0.00001045, c: 0.184, v: 489200000, h: 0.0000112, l: 0.0000088 },
    { s: 'WIF_USDT', p: 2.84, c: 0.142, v: 312000000, h: 3.12, l: 2.45 },
    { s: 'SUI_USDT', p: 3.14, c: 0.126, v: 450000000, h: 3.38, l: 2.76 },
    { s: 'NEAR_USDT', p: 5.65, c: 0.118, v: 280000000, h: 6.05, l: 5.02 },
    { s: 'FET_USDT', p: 1.48, c: 0.114, v: 195000000, h: 1.62, l: 1.31 },
    { s: 'TAO_USDT', p: 560.2, c: 0.108, v: 165000000, h: 595.0, l: 502.0 },
    { s: 'RENDER_USDT', p: 6.42, c: 0.098, v: 210000000, h: 6.95, l: 5.82 },
    { s: 'BONK_USDT', p: 0.0000234, c: 0.095, v: 175000000, h: 0.0000252, l: 0.0000210 },
    { s: 'DOGE_USDT', p: 0.382, c: 0.092, v: 890000000, h: 0.415, l: 0.345 },
    { s: 'POPCAT_USDT', p: 1.62, c: 0.089, v: 140000000, h: 1.78, l: 1.46 },
    { s: 'SOL_USDT', p: 218.4, c: 0.085, v: 1250000000, h: 228.0, l: 198.5 },
    { s: 'SEI_USDT', p: 0.524, c: 0.081, v: 130000000, h: 0.565, l: 0.478 },
    { s: 'TIA_USDT', p: 5.92, c: 0.078, v: 110000000, h: 6.38, l: 5.42 },
    { s: 'APT_USDT', p: 11.24, c: 0.076, v: 165000000, h: 12.10, l: 10.35 },
    { s: 'INJ_USDT', p: 24.8, c: 0.074, v: 95000000, h: 26.5, l: 22.8 },

    // Group 2: Titan Momentum Core (15 assets)
    { s: 'BTC_USDT', p: 91420.0, c: 0.052, v: 3450000000, h: 93200.0, l: 86800.0 },
    { s: 'ETH_USDT', p: 3340.0, c: 0.061, v: 1980000000, h: 3450.0, l: 3120.0 },
    { s: 'XRP_USDT', p: 1.14, c: 0.068, v: 620000000, h: 1.25, l: 1.05 },
    { s: 'BNB_USDT', p: 648.5, c: 0.045, v: 410000000, h: 668.0, l: 622.0 },
    { s: 'AVAX_USDT', p: 35.8, c: 0.067, v: 290000000, h: 38.2, l: 33.1 },
    { s: 'LINK_USDT', p: 16.4, c: 0.058, v: 240000000, h: 17.5, l: 15.2 },
    { s: 'ADA_USDT', p: 0.78, c: 0.063, v: 380000000, h: 0.84, l: 0.72 },
    { s: 'SHIB_USDT', p: 0.0000251, c: 0.057, v: 280000000, h: 0.000027, l: 0.000023 },
    { s: 'LTC_USDT', p: 89.4, c: 0.048, v: 150000000, h: 94.0, l: 84.5 },
    { s: 'DOT_USDT', p: 6.82, c: 0.053, v: 180000000, h: 7.25, l: 6.42 },
    { s: 'BCH_USDT', p: 485.0, c: 0.042, v: 120000000, h: 510.0, l: 462.0 },
    { s: 'XLM_USDT', p: 0.245, c: 0.069, v: 190000000, h: 0.272, l: 0.224 },
    { s: 'UNI_USDT', p: 9.75, c: 0.059, v: 140000000, h: 10.45, l: 9.12 },
    { s: 'ICP_USDT', p: 10.4, c: 0.051, v: 115000000, h: 11.2, l: 9.8 },
    { s: 'ETC_USDT', p: 26.4, c: 0.046, v: 98000000, h: 28.1, l: 24.9 },

    // Group 3: Quantum Velocity (15 assets)
    { s: 'FLOKI_USDT', p: 0.000248, c: -0.078, v: 185000000, h: 0.00028, l: 0.00023 },
    { s: 'JUP_USDT', p: 1.18, c: 0.064, v: 160000000, h: 1.28, l: 1.09 },
    { s: 'ONDO_USDT', p: 1.02, c: 0.071, v: 175000000, h: 1.12, l: 0.94 },
    { s: 'STX_USDT', p: 2.15, c: -0.062, v: 130000000, h: 2.35, l: 2.01 },
    { s: 'KAS_USDT', p: 0.158, c: 0.058, v: 98000000, h: 0.171, l: 0.148 },
    { s: 'AR_USDT', p: 19.8, c: 0.066, v: 88000000, h: 21.4, l: 18.2 },
    { s: 'FTM_USDT', p: 0.74, c: 0.069, v: 120000000, h: 0.81, l: 0.68 },
    { s: 'PYTH_USDT', p: 0.44, c: 0.055, v: 92000000, h: 0.48, l: 0.41 },
    { s: 'PENDLE_USDT', p: 5.48, c: -0.058, v: 85000000, h: 5.95, l: 5.12 },
    { s: 'JTO_USDT', p: 3.25, c: 0.063, v: 76000000, h: 3.55, l: 3.01 },
    { s: 'WLD_USDT', p: 2.65, c: -0.072, v: 140000000, h: 2.95, l: 2.42 },
    { s: 'GALA_USDT', p: 0.029, c: 0.061, v: 89000000, h: 0.032, l: 0.027 },
    { s: 'ALGO_USDT', p: 0.22, c: 0.054, v: 78000000, h: 0.24, l: 0.20 },
    { s: 'BEAM_USDT', p: 0.022, c: 0.059, v: 65000000, h: 0.024, l: 0.020 },
    { s: 'SAND_USDT', p: 0.38, c: 0.052, v: 72000000, h: 0.41, l: 0.35 },

    // Group 4: DeFi & Layer-1 Vanguard (15 assets)
    { s: 'AAVE_USDT', p: 172.5, c: 0.058, v: 110000000, h: 185.0, l: 161.0 },
    { s: 'MKR_USDT', p: 1640.0, c: 0.049, v: 68000000, h: 1740.0, l: 1560.0 },
    { s: 'CRV_USDT', p: 0.395, c: 0.072, v: 84000000, h: 0.435, l: 0.362 },
    { s: 'SNX_USDT', p: 1.88, c: 0.056, v: 54000000, h: 2.05, l: 1.74 },
    { s: 'DYDX_USDT', p: 1.34, c: 0.062, v: 62000000, h: 1.46, l: 1.24 },
    { s: 'ARB_USDT', p: 0.72, c: 0.051, v: 135000000, h: 0.78, l: 0.67 },
    { s: 'OP_USDT', p: 1.84, c: 0.057, v: 145000000, h: 1.99, l: 1.71 },
    { s: 'POL_USDT', p: 0.46, c: 0.048, v: 88000000, h: 0.49, l: 0.43 },
    { s: 'ATOM_USDT', p: 6.45, c: 0.052, v: 92000000, h: 6.95, l: 6.05 },
    { s: 'ROSE_USDT', p: 0.088, c: 0.064, v: 48000000, h: 0.096, l: 0.081 },
    { s: 'RUNE_USDT', p: 5.82, c: 0.068, v: 96000000, h: 6.35, l: 5.40 },
    { s: 'BLUR_USDT', p: 0.28, c: 0.075, v: 52000000, h: 0.31, l: 0.25 },
    { s: '1INCH_USDT', p: 0.36, c: 0.048, v: 42000000, h: 0.39, l: 0.33 },
    { s: 'SUSHI_USDT', p: 0.88, c: 0.054, v: 38000000, h: 0.95, l: 0.81 },
    { s: 'COMP_USDT', p: 54.2, c: 0.046, v: 36000000, h: 58.0, l: 51.0 },

    // Group 5: Alpha Rapid-Scalp (15 assets)
    { s: 'BOME_USDT', p: 0.0094, c: 0.082, v: 115000000, h: 0.0105, l: 0.0086 },
    { s: 'MEME_USDT', p: 0.0142, c: 0.076, v: 82000000, h: 0.0158, l: 0.0131 },
    { s: 'PEOPLE_USDT', p: 0.068, c: 0.088, v: 130000000, h: 0.076, l: 0.061 },
    { s: 'TURBO_USDT', p: 0.0088, c: 0.094, v: 95000000, h: 0.0099, l: 0.0079 },
    { s: 'NEIRO_USDT', p: 0.00192, c: 0.112, v: 170000000, h: 0.0022, l: 0.0017 },
    { s: '1000SATS_USDT', p: 0.00028, c: 0.069, v: 88000000, h: 0.00031, l: 0.00025 },
    { s: 'ORDI_USDT', p: 38.6, c: 0.058, v: 110000000, h: 41.5, l: 36.0 },
    { s: 'BIGTIME_USDT', p: 0.165, c: 0.084, v: 64000000, h: 0.185, l: 0.148 },
    { s: 'ARKM_USDT', p: 2.12, c: 0.077, v: 92000000, h: 2.34, l: 1.94 },
    { s: 'ALT_USDT', p: 0.112, c: 0.065, v: 48000000, h: 0.124, l: 0.102 },
    { s: 'STRK_USDT', p: 0.49, c: 0.058, v: 76000000, h: 0.54, l: 0.45 },
    { s: 'ZRO_USDT', p: 3.85, c: 0.062, v: 84000000, h: 4.18, l: 3.56 },
    { s: 'ZK_USDT', p: 0.155, c: 0.067, v: 68000000, h: 0.171, l: 0.142 },
    { s: 'DYM_USDT', p: 1.72, c: 0.071, v: 54000000, h: 1.89, l: 1.58 },
    { s: 'MANTA_USDT', p: 0.84, c: 0.063, v: 58000000, h: 0.92, l: 0.78 },
  ];

  const result: MexcTicker[] = [];
  const groupSize = 15;

  for (let g = 0; g < ASSET_GROUPS.length; g++) {
    const groupName = ASSET_GROUPS[g].name;
    const items = assetPool.slice(g * groupSize, (g + 1) * groupSize);
    for (const item of items) {
      const rangePct = ((item.h - item.l) / item.p) * 100;
      const volatilityScore = Math.abs(item.c * 100) * 1.5 + rangePct;
      result.push({
        symbol: item.s,
        lastPrice: item.p,
        riseFallRate: item.c,
        volume24: item.v,
        amount24: item.v * item.p,
        high24Price: item.h,
        low24Price: item.l,
        fairPrice: item.p,
        fundingRate: 0.0001,
        volatilityScore,
        groupName,
        groupIndex: g,
      });
    }
  }

  return result;
}

/**
 * Generate synthetic 5-minute candles mimicking natural crypto volatility
 */
export function generateSyntheticKlines(symbol: string, count: number = 60): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const fiveMinMs = 5 * 60 * 1000;

  // Derive starting base price from symbol
  let basePrice = 100;
  if (symbol.startsWith('BTC')) basePrice = 91400;
  else if (symbol.startsWith('ETH')) basePrice = 3340;
  else if (symbol.startsWith('SOL')) basePrice = 218;
  else if (symbol.startsWith('SUI')) basePrice = 3.15;
  else if (symbol.startsWith('PEPE')) basePrice = 0.0000104;
  else if (symbol.startsWith('WIF')) basePrice = 2.85;
  else if (symbol.startsWith('DOGE')) basePrice = 0.38;

  let current = basePrice;
  const startTs = now - count * fiveMinMs;

  for (let i = 0; i < count; i++) {
    const ts = startTs + i * fiveMinMs;
    // Generate organic micro-swings
    const swingFactor = Math.sin(i / 4) * 0.008 + (Math.random() - 0.49) * 0.006;
    const open = current;
    const close = open * (1 + swingFactor);
    const wickHigh = Math.max(open, close) * (1 + Math.random() * 0.004);
    const wickLow = Math.min(open, close) * (1 - Math.random() * 0.004);
    const baseVol = 150000;
    // occasional volume spikes on raid bars
    const volMult = i % 18 === 0 ? 2.3 : 0.8 + Math.random() * 0.5;

    candles.push({
      timestamp: ts,
      open: Number(open.toFixed(6)),
      high: Number(wickHigh.toFixed(6)),
      low: Number(wickLow.toFixed(6)),
      close: Number(close.toFixed(6)),
      volume: Math.round(baseVol * volMult),
    });

    current = close;
  }

  return candles;
}
