import crypto from 'crypto';
import { Candle, StrategyConfig, DEFAULT_CONFIG } from './strategy';

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
  { id: 'apex-momentum', code: 'APEX MOMENTUM', name: 'Apex Momentum', strategy: 'CRUDE OIL', assignedGroup: 'Apex Cyber-Volatiles', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'mean-reversion', code: 'MEAN REVERSION', name: 'Mean Reversion', strategy: 'CRUDE OIL', assignedGroup: 'Titan Momentum Core', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'breakout-hunter', code: 'BREAKOUT HUNTER', name: 'Breakout Hunter', strategy: 'CRUDE OIL', assignedGroup: 'Quantum Velocity', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'rapid-scalper', code: 'RAPID SCALPER', name: 'Rapid Scalper', strategy: 'CRUDE OIL', assignedGroup: 'Alpha Rapid-Scalp', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'swing-raider', code: 'SWING RAIDER', name: 'Swing Raider', strategy: 'CRUDE OIL', assignedGroup: 'DeFi & Layer-1 Vanguard', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'volatility-reaper', code: 'VOLATILITY REAPER', name: 'Volatility Reaper', strategy: 'CRUDE OIL', assignedGroup: 'Apex Cyber-Volatiles', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'liquidity-sweeper', code: 'LIQUIDITY SWEEPER', name: 'Liquidity Sweeper', strategy: 'CRUDE OIL', assignedGroup: 'Quantum Velocity', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'order-flow-reaper', code: 'ORDER FLOW REAPER', name: 'Order Flow Reaper', strategy: 'CRUDE OIL', assignedGroup: 'Alpha Rapid-Scalp', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
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
  contractVol: number; // MEXC contract quantity opened on the exchange
  closedVol: number; // Contracts already closed via TP1/TP2 scaling
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
}

export interface TradeLog {
  id: string;
  timestamp: number;
  groupName: string;
  botCode?: string;
  botName?: string;
  symbol: string;
  type: 'SCAN_SIGNAL' | 'ENTRY' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'SL_HIT' | 'TELEGRAM_DISPATCH';
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
  { name: 'Alpha Rapid-Scalp', description: 'High-turnover volatile contracts ideal for 3-minute CRUDE OIL signals' },
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
    console.error('[MEXC API] Ticker fetch failed:', err);
    throw new Error('MEXC ticker fetch failed — market data unavailable');
  }
  throw new Error('MEXC ticker fetch failed — insufficient market data returned');
}

/**
 * Fetch candles from MEXC Futures REST API
 * @param symbol Contract symbol (e.g. 'BTC_USDT')
 * @param limit Number of candles to fetch
 * @param interval Candle interval: 'Min1', 'Min3', 'Min5', 'Min15', 'Min30', 'Hour1', 'Hour4', 'Day1'
 */
export async function fetchMexcKlines(symbol: string, limit: number = 60, interval: string = 'Min5'): Promise<Candle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://contract.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}`, {
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
    console.error(`[MEXC API] Kline fetch failed for ${symbol}:`, err);
  }
  return [];
}

// ─── MEXC Futures Order Execution ──────────────────────────────────────────

const MEXC_CONTRACT_BASE = 'https://contract.mexc.com';

const contractSizeCache = new Map<string, number>();

export async function fetchMexcContractSize(symbol: string): Promise<number | null> {
  const cached = contractSizeCache.get(symbol);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${MEXC_CONTRACT_BASE}/api/v1/contract/detail?symbol=${symbol}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const size = Number(data?.data?.contractSize);
      if (data?.success && size > 0) {
        contractSizeCache.set(symbol, size);
        return size;
      }
    }
  } catch (err) {
    console.warn(`[MEXC API] Contract detail fetch failed for ${symbol}:`, err);
  }
  return null;
}

export interface MexcOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL'; // BUY = open long (side 1), SELL = open short (side 3)
  type?: number; // 1 = limit, 5 = market (default)
  openType?: number; // 1 = isolated, 2 = cross (default 1 when leverage set)
  leverage?: number;
  vol?: number; // Contract quantity
  price?: number; // For limit orders
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export interface MexcOrderResult {
  success: boolean;
  orderId?: string;
  code?: number;
  message?: string;
}

export interface MexcPositionInfo {
  symbol: string;
  positionType: number; // 1=Long, 2=Short
  openQty: number;
  availableQty: number;
  openPrice: number;
  unrealisedProfit: number;
  leverage: number;
  liquidationPrice: number;
}

export interface MexcBalanceInfo {
  availableBalance: number;
  totalEquity: number;
  unrealisedProfit: number;
}

/**
 * Execute authenticated request to MEXC Contract API.
 * Auth always via headers (ApiKey / Request-Time / Signature):
 * signature = HMAC(secret, apiKey + reqTime + paramStr) where
 * paramStr = dictionary-sorted "k=v&..." for GET, raw JSON string for POST.
 */
async function mexcAuthRequest(
  apiKey: string,
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  bodyParams: Record<string, string | number> = {}
): Promise<any> {
  const reqTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let paramStr = '';
  let url: string;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    signal: controller.signal,
  };

  if (method === 'GET') {
    paramStr = Object.keys(bodyParams).sort().map((k) => `${k}=${bodyParams[k]}`).join('&');
    url = `${MEXC_CONTRACT_BASE}${path}${paramStr ? `?${paramStr}` : ''}`;
  } else {
    paramStr = JSON.stringify(bodyParams);
    url = `${MEXC_CONTRACT_BASE}${path}`;
    options.body = paramStr;
  }

  const signature = crypto.createHmac('sha256', secretKey).update(`${apiKey}${reqTime}${paramStr}`).digest('hex');
  options.headers = {
    ...(options.headers as Record<string, string>),
    'ApiKey': apiKey,
    'Request-Time': reqTime.toString(),
    'Signature': signature,
  };

  try {
    const res = await fetch(url, options);
    clearTimeout(timeout);
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Place a futures order on MEXC
 */
export async function placeMexcOrder(
  apiKey: string,
  secretKey: string,
  params: MexcOrderParams
): Promise<MexcOrderResult> {
  try {
    // MEXC numeric sides: 1 = open long, 3 = open short
    const bodyParams: Record<string, string | number> = {
      symbol: params.symbol,
      side: params.side === 'BUY' ? 1 : 3,
      type: Number(params.type || 5), // 5 = market order
      vol: params.vol || 0,
    };

    if (params.leverage) {
      // Set leverage first via separate endpoint
      await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/leverage', {
        symbol: params.symbol,
        leverage: params.leverage,
        positionType: params.side === 'BUY' ? 1 : 2,
      });
      // Leverage is required on the order itself for isolated margin
      bodyParams.leverage = params.leverage;
      bodyParams.openType = params.openType || 1; // 1 = isolated, 2 = cross
    }

    if (params.price && params.type === 1) {
      bodyParams.price = params.price;
    }

    const result = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/order/submit', bodyParams);

    if (result && result.success) {
      return { success: true, orderId: result.data?.orderId };
    }

    return {
      success: false,
      code: result?.code,
      message: result?.message || 'Order placement failed',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error',
    };
  }
}

/**
 * Set Take Profit / Stop Loss for an existing position
 */
export async function setMexcTPSL(
  apiKey: string,
  secretKey: string,
  symbol: string,
  positionType: 1 | 2, // 1=Long, 2=Short
  stopLossPrice?: number,
  takeProfitPrice?: number
): Promise<MexcOrderResult> {
  try {
    const bodyParams: Record<string, string | number> = {
      symbol,
      positionType,
    };

    if (stopLossPrice) bodyParams.stopLossPrice = stopLossPrice;
    if (takeProfitPrice) bodyParams.takeProfitPrice = takeProfitPrice;

    const result = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/position/tpsl/submit', bodyParams);

    if (result && result.success) {
      return { success: true };
    }

    return {
      success: false,
      code: result?.code,
      message: result?.message || 'TP/SL setup failed',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error',
    };
  }
}

/**
 * Cancel an open order on MEXC
 */
export async function cancelMexcOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  orderId: string
): Promise<MexcOrderResult> {
  try {
    const result = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/order/cancel', {
      symbol,
      orderId,
    });

    if (result && result.success) {
      return { success: true };
    }

    return {
      success: false,
      code: result?.code,
      message: result?.message || 'Cancel failed',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error',
    };
  }
}

/**
 * Fetch all open positions from MEXC
 */
export async function fetchMexcPositions(
  apiKey: string,
  secretKey: string
): Promise<MexcPositionInfo[]> {
  const result = await mexcAuthRequest(apiKey, secretKey, 'GET', '/api/v1/private/position/open_positions');

  if (result && result.success && Array.isArray(result.data)) {
    return result.data.map((p: any) => ({
      symbol: p.symbol,
      positionType: p.positionType,
      openQty: Number(p.holdVol) || 0,
      availableQty: Number(p.availableVol) || Number(p.holdVol) || 0,
      openPrice: Number(p.openAvgPrice) || 0,
      unrealisedProfit: Number(p.unrealisedProfit) || 0,
      leverage: Number(p.leverage) || 10,
      liquidationPrice: Number(p.liquidationPrice) || 0,
    }));
  }

  throw new Error(result?.message || `MEXC positions error (code ${result?.code})`);
}

/**
 * Fetch account balance from MEXC
 */
export async function fetchMexcBalance(
  apiKey: string,
  secretKey: string
): Promise<MexcBalanceInfo | null> {
  const result = await mexcAuthRequest(apiKey, secretKey, 'GET', '/api/v1/private/account/assets');

  if (result && result.success && Array.isArray(result.data)) {
    if (result.data.length === 0) return null;
    const usdtAsset = result.data.find((a: any) => a.currency === 'USDT') || result.data[0];
    return {
      availableBalance: Number(usdtAsset.availableBalance) || 0,
      totalEquity: Number(usdtAsset.equity) || Number(usdtAsset.walletBalance) || 0,
      unrealisedProfit: Number(usdtAsset.unrealisedProfit) || 0,
    };
  }

  throw new Error(result?.message || `MEXC balance error (code ${result?.code})`);
}

/**
 * Fetch account position mode (1 = hedge, 2 = one-way)
 */
export async function fetchMexcPositionMode(
  apiKey: string,
  secretKey: string
): Promise<any> {
  try {
    return await mexcAuthRequest(apiKey, secretKey, 'GET', '/api/v1/private/position/position_mode');
  } catch (err) {
    console.warn('[MEXC] Failed to fetch position mode:', err);
    return null;
  }
}

/**
 * Close a position (market order) — numeric close sides: 4 = close long, 2 = close short
 */
export async function closeMexcPosition(
  apiKey: string,
  secretKey: string,
  symbol: string,
  positionType: 1 | 2,
  quantity: number
): Promise<MexcOrderResult> {
  try {
    const result = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/order/submit', {
      symbol,
      side: positionType === 1 ? 4 : 2,
      type: 5, // Market
      vol: quantity,
    });

    if (result && result.success) {
      return { success: true, orderId: result.data?.orderId };
    }
    return {
      success: false,
      code: result?.code,
      message: result?.message || 'Close failed',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error',
    };
  }
}
