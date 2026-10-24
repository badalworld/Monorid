import crypto from 'crypto';
import { DEFAULT_CONFIG } from './strategy.ts';
import type { Candle, StrategyConfig } from './strategy.ts';


// ─── Rate-limit-aware fetch helper ─────────────────────────────────────────
/**
 * Wraps fetch with automatic retry on HTTP 429 (Too Many Requests) and network errors.
 * Uses independent per-attempt timeouts and does not poison retries with aborted attempt signals.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  timeoutMs = 6000
): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    if (options.signal?.aborted) {
      throw new Error('fetchWithRetry: operation aborted by caller signal');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const parentSignal = options.signal;
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const fetchOptions: RequestInit = {
        ...options,
        signal: controller.signal,
      };

      const res = await fetch(url, fetchOptions);
      clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }

      if ((res.status === 429 || (res.status >= 500 && res.status <= 504)) && attempt < maxRetries) {
        const retryAfter = res.headers.get('Retry-After');
        const delayMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(600 * 2 ** attempt, 3000);
        console.warn(
          `[MEXC] HTTP ${res.status}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
      lastError = err;

      if (parentSignal?.aborted) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.min(600 * 2 ** attempt, 3000);
        console.warn(
          `[MEXC] Fetch attempt ${attempt + 1}/${maxRetries + 1} failed (${err?.name || 'Error'}: ${err?.message}), retrying in ${delayMs}ms:`,
          url
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      attempt++;
    }
  }

  throw lastError ?? new Error('fetchWithRetry: max retries exceeded');
}


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

export const MAX_OPEN_POSITIONS = 999; // Unlimited positions

export const OFFICIAL_BOT_UNITS: BotDefinition[] = [
  { id: 'apex-momentum', code: 'APEX MOMENTUM', name: 'Apex Momentum', strategy: 'MONORID QUANT', assignedGroup: 'Apex Cyber-Volatiles', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'mean-reversion', code: 'MEAN REVERSION', name: 'Mean Reversion', strategy: 'MONORID QUANT', assignedGroup: 'Titan Momentum Core', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'breakout-hunter', code: 'BREAKOUT HUNTER', name: 'Breakout Hunter', strategy: 'MONORID QUANT', assignedGroup: 'Quantum Velocity', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'rapid-scalper', code: 'RAPID SCALPER', name: 'Rapid Scalper', strategy: 'MONORID QUANT', assignedGroup: 'Alpha Rapid-Scalp', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'swing-raider', code: 'SWING RAIDER', name: 'Swing Raider', strategy: 'MONORID QUANT', assignedGroup: 'DeFi & Layer-1 Vanguard', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'volatility-reaper', code: 'VOLATILITY REAPER', name: 'Volatility Reaper', strategy: 'MONORID QUANT', assignedGroup: 'AI & Cyber Innovators', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'liquidity-sweeper', code: 'LIQUIDITY SWEEPER', name: 'Liquidity Sweeper', strategy: 'MONORID QUANT', assignedGroup: 'Quantum Velocity', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
  { id: 'order-flow-reaper', code: 'ORDER FLOW REAPER', name: 'Order Flow Reaper', strategy: 'MONORID QUANT', assignedGroup: 'Alpha Rapid-Scalp', pnl: 0, status: 'ACTIVE', tradesCount: 0 },
];

export interface MexcPosition {
  id: string;
  orderId?: string;
  positionId?: number | string;
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
  realizedPnlPct?: number;
  exitPrice?: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: number;
  closedAt?: number;
  closeReason?: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL';
  fee?: number; // MEXC trading fee (positive number, deducted as -fee)
  fundingFee?: number; // MEXC funding fee (+ received, - paid)
  netRealizedPnl?: number; // Gross Realized PnL - fee + fundingFee
}

export type ClosedTrade = MexcPosition;

export interface OrderFeeAndFunding {
  fee: number;
  fundingFee: number;
  realizedPnl: number;
  netPnl: number;
}

export const MIN_AVAILABLE_BALANCE_USDT = 0.70;

/**
 * Reconstructs standard 1:2 Take Profit and EMA 200 Stop Loss targets (1.5% SL risk, 3.0% TP)
 * for a position if historical order records do not provide them.
 * Uses adaptive decimal precision so low-price crypto assets (e.g. FLOKI, PEPE) do not collapse to entry price.
 */
export function reconstructStrategyTargets(entryPrice: number, side: 'LONG' | 'SHORT') {
  const safeEntry = entryPrice > 0 ? entryPrice : 1;
  const riskDist = safeEntry * 0.015;
  const isLong = side === 'LONG';
  const decimals = safeEntry < 0.0001 ? 8 : safeEntry < 0.01 ? 7 : safeEntry < 1 ? 6 : safeEntry < 100 ? 4 : 2;
  let slPrice = Number((isLong ? safeEntry - riskDist : safeEntry + riskDist).toFixed(decimals));
  let tp1Price = Number((isLong ? safeEntry + riskDist * 2.0 : safeEntry - riskDist * 2.0).toFixed(decimals));

  // Strict invariant: For LONG, tp1Price > entryPrice and slPrice < entryPrice.
  // For SHORT, tp1Price < entryPrice and slPrice > entryPrice.
  if (isLong) {
    if (tp1Price <= safeEntry) {
      tp1Price = Number((safeEntry + Math.max(riskDist * 2.0, Math.pow(10, -decimals))).toFixed(decimals));
    }
    if (slPrice >= safeEntry) {
      slPrice = Number((safeEntry - Math.max(riskDist, Math.pow(10, -decimals))).toFixed(decimals));
    }
  } else {
    if (tp1Price >= safeEntry) {
      tp1Price = Number(Math.max(0, safeEntry - Math.max(riskDist * 2.0, Math.pow(10, -decimals))).toFixed(decimals));
    }
    if (slPrice <= safeEntry) {
      slPrice = Number((safeEntry + Math.max(riskDist, Math.pow(10, -decimals))).toFixed(decimals));
    }
  }

  return { slPrice, tp1Price, tp2Price: tp1Price, tp3Price: tp1Price };
}

/**
 * Extracts trading fee (positive deduction), funding fee (+/-), realized PnL,
 * and net realized PnL from a MEXC order or history position record.
 */
export function extractOrderFeeAndFunding(order: any): OrderFeeAndFunding {
  if (!order || typeof order !== 'object') {
    return { fee: 0, fundingFee: 0, realizedPnl: 0, netPnl: 0 };
  }

  // 1. Trading Fee (always non-negative expense)
  let rawFee = 0;
  if (order.totalFee !== undefined && order.totalFee !== null && !isNaN(Number(order.totalFee))) {
    rawFee = Math.abs(Number(order.totalFee));
  } else if (order.fee !== undefined && order.fee !== null && !isNaN(Number(order.fee))) {
    rawFee = Math.abs(Number(order.fee));
  } else if (order.openFee !== undefined || order.closeFee !== undefined) {
    const openFee = Math.abs(Number(order.openFee) || 0);
    const closeFee = Math.abs(Number(order.closeFee) || 0);
    rawFee = openFee + closeFee;
  } else {
    const taker = Math.abs(Number(order.takerFee) || 0);
    const maker = Math.abs(Number(order.makerFee) || 0);
    rawFee = taker + maker;
  }
  const fee = Number(rawFee.toFixed(6));

  // 2. Funding Fee (signed: positive = received, negative = paid)
  const rawFunding = order.fundingFee !== undefined && order.fundingFee !== null
    ? Number(order.fundingFee)
    : order.funding !== undefined && order.funding !== null
    ? Number(order.funding)
    : 0;
  const fundingFee = isNaN(rawFunding) ? 0 : Number(rawFunding.toFixed(6));

  // 3. Realized PnL (gross profit/loss from MEXC order or history position)
  const rawProfit = order.closeProfit !== undefined && order.closeProfit !== null
    ? Number(order.closeProfit)
    : order.profit !== undefined && order.profit !== null
    ? Number(order.profit)
    : order.realised !== undefined && order.realised !== null
    ? Number(order.realised)
    : order.realizedPnl !== undefined && order.realizedPnl !== null
    ? Number(order.realizedPnl)
    : 0;
  const realizedPnl = isNaN(rawProfit) ? 0 : Number(rawProfit.toFixed(6));

  // 4. Net PnL = Gross Realized PnL - Trading Fee + Funding Fee
  const netPnl = Number((realizedPnl - fee + fundingFee).toFixed(6));

  return {
    fee,
    fundingFee,
    realizedPnl,
    netPnl,
  };
}

/**
 * Deduplicates closed positions so that each unique trade appears exactly ONCE.
 * Merges duplicate entries arising from local trigger vs exchange history orders,
 * preserves original bot attribution and TP/SL target prices, removes synthetic
 * $0.00 TP1 duplicate records, and computes accurate net realized P&L after fees.
 */
export function deduplicateClosedPositions(positions: MexcPosition[]): MexcPosition[] {
  if (!Array.isArray(positions) || positions.length === 0) return [];

  const openPositions: MexcPosition[] = [];
  const closedPositions: MexcPosition[] = [];

  for (const pos of positions) {
    if (pos.status === 'OPEN') {
      openPositions.push(pos);
    } else {
      closedPositions.push(pos);
    }
  }

  // Ensure open positions have no duplicate symbols
  const uniqueOpen: MexcPosition[] = [];
  const seenOpenSymbols = new Set<string>();
  for (const pos of openPositions) {
    if (!seenOpenSymbols.has(pos.symbol)) {
      seenOpenSymbols.add(pos.symbol);
      uniqueOpen.push(pos);
    }
  }

  const mergedClosed: MexcPosition[] = [];

  const areDuplicates = (a: MexcPosition, b: MexcPosition): boolean => {
    if (a.id && b.id && a.id === b.id) return true;

    const aOrderId = a.orderId || (a.id.startsWith('mexc-') ? a.id.slice(5) : undefined);
    const bOrderId = b.orderId || (b.id.startsWith('mexc-') ? b.id.slice(5) : undefined);
    if (aOrderId && bOrderId && aOrderId === bOrderId) return true;

    if (a.positionId && b.positionId && String(a.positionId) === String(b.positionId)) return true;

    const normA = (a.symbol || '').replace('_USDT', '').toUpperCase();
    const normB = (b.symbol || '').replace('_USDT', '').toUpperCase();

    if (normA && normB && normA === normB) {
      const sidesMatch = !a.side || !b.side || a.side === b.side;
      if (sidesMatch) {
        const aTime = a.closedAt || a.createdAt || 0;
        const bTime = b.closedAt || b.createdAt || 0;
        // Merge if timestamps are within 10 minutes (600s)
        if (aTime > 0 && bTime > 0 && Math.abs(aTime - bTime) <= 600000) {
          return true;
        }
        // Also merge if entry prices match within 0.5% tolerance
        if (a.entryPrice > 0 && b.entryPrice > 0) {
          const priceDiff = Math.abs(a.entryPrice - b.entryPrice) / Math.max(a.entryPrice, b.entryPrice);
          if (priceDiff < 0.005) {
            return true;
          }
        }
      }
    }

    return false;
  };

  const mergeTwoTrades = (existing: MexcPosition, incoming: MexcPosition): MexcPosition => {
    const incomingHasRealBot = incoming.groupName !== 'Resynced (Exchange)' && incoming.groupName !== 'MEXC Exchange History' && incoming.botCode !== 'EXCHANGE';
    const existingHasRealBot = existing.groupName !== 'Resynced (Exchange)' && existing.groupName !== 'MEXC Exchange History' && existing.botCode !== 'EXCHANGE';

    const preferredBot = incomingHasRealBot && !existingHasRealBot
      ? incoming
      : existing;

    const side = existing.side || incoming.side || 'LONG';
    const isLong = side === 'LONG';
    const entryPrice = existing.entryPrice > 0 ? existing.entryPrice : (incoming.entryPrice > 0 ? incoming.entryPrice : 0);
    const exitPrice = incoming.exitPrice && incoming.exitPrice > 0
      ? incoming.exitPrice
      : (existing.exitPrice || incoming.currentPrice || existing.currentPrice || entryPrice);

    // Targets: preserve existing, fallback to incoming, or reconstruct from strategy
    const targets = reconstructStrategyTargets(entryPrice, side);
    const slPrice = existing.slPrice > 0 ? existing.slPrice : (incoming.slPrice > 0 ? incoming.slPrice : targets.slPrice);
    const tp1Price = existing.tp1Price > 0 ? existing.tp1Price : (incoming.tp1Price > 0 ? incoming.tp1Price : targets.tp1Price);
    const tp2Price = existing.tp2Price > 0 ? existing.tp2Price : (incoming.tp2Price > 0 ? incoming.tp2Price : targets.tp2Price);
    const tp3Price = existing.tp3Price > 0 ? existing.tp3Price : (incoming.tp3Price > 0 ? incoming.tp3Price : targets.tp3Price);

    let realizedPnl = existing.realizedPnl;
    if (Math.abs(realizedPnl) < 0.0001 && Math.abs(incoming.realizedPnl) >= 0.0001) {
      realizedPnl = incoming.realizedPnl;
    } else if (Math.abs(incoming.realizedPnl) >= 0.0001 && incoming.id.startsWith('mexc-')) {
      realizedPnl = incoming.realizedPnl;
    }

    const realizedPnlPct = incoming.realizedPnlPct !== undefined && incoming.realizedPnlPct !== 0
      ? incoming.realizedPnlPct
      : existing.realizedPnlPct;

    // Fees: prefer exchange-confirmed fee from MEXC order over estimated local fee
    const incomingIsExchange = incoming.id.startsWith('mexc-') || Boolean(incoming.orderId);
    const existingIsExchange = existing.id.startsWith('mexc-') || Boolean(existing.orderId);
    let fee: number;
    if (incomingIsExchange && incoming.fee !== undefined && incoming.fee > 0) {
      fee = incoming.fee;
    } else if (existingIsExchange && existing.fee !== undefined && existing.fee > 0) {
      fee = existing.fee;
    } else {
      fee = Number(Math.max(existing.fee || 0, incoming.fee || 0).toFixed(6));
    }

    const fundingFee = Number((incoming.fundingFee !== undefined && incoming.fundingFee !== 0
      ? incoming.fundingFee
      : (existing.fundingFee || 0)).toFixed(6));
    const netRealizedPnl = Number((realizedPnl - fee + fundingFee).toFixed(6));

    const reachedTp = isLong
      ? (exitPrice >= tp1Price && tp1Price > entryPrice)
      : (exitPrice <= tp1Price && tp1Price < entryPrice && tp1Price > 0);
    const reachedSl = isLong
      ? (exitPrice <= slPrice && slPrice < entryPrice && slPrice > 0)
      : (exitPrice >= slPrice && slPrice > entryPrice);

    // Preserve explicit close reason with proper priority:
    // Only classify as SL if price actually reached SL AND trade had a loss.
    // Only classify as TP1 if price actually reached TP1 AND trade had a profit.
    // Premature exits, manual closes, or unreached targets are strictly MANUAL.
    let closeReason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL';
    let tp1Hit = false;
    let slHit = false;

    if (reachedSl && realizedPnl < -0.0001) {
      closeReason = 'SL';
      slHit = true;
    } else if (reachedTp && realizedPnl > 0.0001) {
      closeReason = 'TP1';
      tp1Hit = true;
    } else if (existing.closeReason === 'TP2' || incoming.closeReason === 'TP2') {
      closeReason = 'TP2';
      tp1Hit = true;
    } else if (existing.closeReason === 'TP3' || incoming.closeReason === 'TP3') {
      closeReason = 'TP3';
      tp1Hit = true;
    } else {
      closeReason = 'MANUAL';
    }

    const orderId = incoming.orderId || existing.orderId || (incoming.id.startsWith('mexc-') ? incoming.id.slice(5) : (existing.id.startsWith('mexc-') ? existing.id.slice(5) : undefined));
    const positionId = incoming.positionId || existing.positionId;
    const closedAt = (existing.closedAt && incoming.closedAt)
      ? Math.min(existing.closedAt, incoming.closedAt)
      : (existing.closedAt || incoming.closedAt || Date.now());
    const createdAt = (existing.createdAt && incoming.createdAt)
      ? Math.min(existing.createdAt, incoming.createdAt)
      : (existing.createdAt || incoming.createdAt || Date.now());

    const finalId = orderId ? `mexc-${orderId}` : (existing.id || incoming.id);

    return {
      id: finalId,
      orderId,
      positionId,
      symbol: existing.symbol || incoming.symbol,
      groupName: preferredBot.groupName,
      botId: preferredBot.botId,
      botCode: preferredBot.botCode,
      botName: preferredBot.botName,
      side,
      entryPrice,
      currentPrice: exitPrice,
      exitPrice,
      leverage: existing.leverage || incoming.leverage || 10,
      initialSize: existing.initialSize || incoming.initialSize || 10,
      currentSize: 0,
      equityUsed: existing.equityUsed || incoming.equityUsed || 10,
      contractVol: existing.contractVol || incoming.contractVol || 1,
      closedVol: existing.closedVol || incoming.closedVol || 1,
      slPrice,
      tp1Price,
      tp2Price,
      tp3Price,
      tp1Hit: reachedTp,
      tp2Hit: existing.tp2Hit || incoming.tp2Hit,
      tp3Hit: existing.tp3Hit || incoming.tp3Hit,
      slHit: reachedSl,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      realizedPnl,
      realizedPnlPct,
      fee,
      fundingFee,
      netRealizedPnl,
      status: 'CLOSED',
      createdAt,
      closedAt,
      closeReason,
    };
  };

  for (const pos of closedPositions) {
    // Discard phantom unexecuted trades (0 PnL, exit == entry, no exchange order ID)
    const pnl = pos.realizedPnl || 0;
    const isZeroPnl = Math.abs(pnl) <= 0.0001;
    const exitPrice = pos.exitPrice || pos.currentPrice || pos.entryPrice || 0;
    const entryPrice = pos.entryPrice || 0;
    const isZeroMove = Math.abs(exitPrice - entryPrice) <= 0.00000001;
    const isExchangeOrder = Boolean(pos.orderId || pos.id?.startsWith('mexc-'));

    if (isZeroPnl && isZeroMove && !isExchangeOrder) {
      continue;
    }

    const existingIdx = mergedClosed.findIndex((item) => areDuplicates(item, pos));
    if (existingIdx >= 0) {
      mergedClosed[existingIdx] = mergeTwoTrades(mergedClosed[existingIdx], pos);
    } else {
      const side = pos.side || 'LONG';
      const isLong = side === 'LONG';
      const targets = entryPrice > 0 ? reconstructStrategyTargets(entryPrice, side) : { slPrice: 0, tp1Price: 0, tp2Price: 0, tp3Price: 0 };
      const slPrice = pos.slPrice > 0 ? pos.slPrice : targets.slPrice;
      const tp1Price = pos.tp1Price > 0 ? pos.tp1Price : targets.tp1Price;
      const tp2Price = pos.tp2Price > 0 ? pos.tp2Price : targets.tp2Price;
      const tp3Price = pos.tp3Price > 0 ? pos.tp3Price : targets.tp3Price;
      const fee = pos.fee || 0;
      const fundingFee = pos.fundingFee || 0;
      const net = pos.netRealizedPnl !== undefined ? pos.netRealizedPnl : (pnl - fee + fundingFee);

      const reachedTp = isLong
        ? (exitPrice >= tp1Price && tp1Price > entryPrice)
        : (exitPrice <= tp1Price && tp1Price < entryPrice && tp1Price > 0);
      const reachedSl = isLong
        ? (exitPrice <= slPrice && slPrice < entryPrice && slPrice > 0)
        : (exitPrice >= slPrice && slPrice > entryPrice);

      // Strict close reason and hit attribution: TP1 requires profit > 0.0001 AND reachedTp; SL requires loss < -0.0001 AND reachedSl
      let closeReason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL';
      let tp1Hit = false;
      let slHit = false;

      if (pos.closeReason === 'MANUAL') {
        closeReason = 'MANUAL';
      } else if (pos.closeReason === 'TP2') {
        closeReason = 'TP2';
        tp1Hit = true;
      } else if (pos.closeReason === 'TP3') {
        closeReason = 'TP3';
        tp1Hit = true;
      } else if (reachedTp && pnl > 0.0001) {
        closeReason = 'TP1';
        tp1Hit = true;
      } else if (reachedSl && pnl < -0.0001) {
        closeReason = 'SL';
        slHit = true;
      } else {
        closeReason = 'MANUAL';
      }

      mergedClosed.push({
        ...pos,
        exitPrice: exitPrice || entryPrice,
        slPrice,
        tp1Price,
        tp2Price,
        tp3Price,
        tp1Hit,
        slHit,
        closeReason,
        fee,
        fundingFee,
        netRealizedPnl: Number(net.toFixed(6)),
      });
    }
  }

  mergedClosed.sort((a, b) => (b.closedAt || b.createdAt || 0) - (a.closedAt || a.createdAt || 0));

  return [...uniqueOpen, ...mergedClosed];
}

export type TradeLogType =
  | 'MARKET_SCAN'
  | 'NEW_OPPORTUNITY'
  | 'ELIMINATED_OPPORTUNITY'
  | 'TRADE_EXECUTED'
  | 'TP_HIT'
  | 'SL_HIT'
  | 'MONORID_RUNNING'
  | 'MONORID_STOP'
  | 'ENTRY'
  | 'TP1_HIT'
  | 'TP2_HIT'
  | 'TP3_HIT'
  | 'SCAN_SIGNAL'
  | 'TELEGRAM_DISPATCH'
  | 'TPSL'
  | 'SYSTEM_STATUS';

export interface TradeLog {
  id: string;
  timestamp: number;
  groupName: string;
  botCode?: string;
  botName?: string;
  symbol: string;
  type: TradeLogType;
  side: 'LONG' | 'SHORT' | 'INFO';
  price: number;
  sizeFraction?: string;
  pnl?: number;
  fee?: number;
  fundingFee?: number;
  netPnl?: number;
  message: string;
  details?: Record<string, any>;
}

// Group naming definitions for 15 assets per group (6 groups = 90 contracts)
export const ASSET_GROUPS = [
  { name: 'Apex Cyber-Volatiles', description: 'Top 15 highest volatility & 24h price momentum surge contracts' },
  { name: 'Titan Momentum Core', description: 'High-liquidity large cap breakout assets with elevated volume velocity' },
  { name: 'Quantum Velocity', description: 'High-beta momentum contracts with wide intraday ranges' },
  { name: 'DeFi & Layer-1 Vanguard', description: 'Fast-moving decentralized ecosystem and infrastructure runners' },
  { name: 'Alpha Rapid-Scalp', description: 'High-turnover volatile contracts ideal for 1-minute Monorid signals' },
  { name: 'AI & Cyber Innovators', description: 'Emerging artificial intelligence, web3, and high-velocity innovation runners' },
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

// Exclude traditional equities, commodities, and fiat forex contracts
export const NON_CRYPTO_SYMBOLS = new Set([
  'TESLA_USDT',
  'COINBASE_USDT',
  'APPLE_USDT',
  'NVDA_USDT',
  'AMZN_USDT',
  'MSFT_USDT',
  'GOOGL_USDT',
  'META_USDT',
  'BABA_USDT',
  'NFLX_USDT',
  'AMD_USDT',
  'PLTR_USDT',
  'TSLA_USDT',
  'AAPL_USDT',
  'USOIL_USDT',
  'UKOIL_USDT',
  'XAU_USDT',
  'XAG_USDT',
  'COPPER_USDT',
  'EUR_USDT',
  'GBP_USDT',
  'JPY_USDT',
  'NG_USDT',
]);

export const THEMATIC_SETS: Record<number, Set<string>> = {
  // 1: Titan Momentum Core (Large-cap established assets)
  1: new Set([
    'BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT', 'ADA_USDT',
    'DOGE_USDT', 'LINK_USDT', 'LTC_USDT', 'BCH_USDT', 'XLM_USDT', 'ETC_USDT',
    'TRX_USDT', 'HBAR_USDT', 'VET_USDT', 'XMR_USDT', 'EOS_USDT', 'DOT_USDT', 'ATOM_USDT'
  ]),
  // 2: Quantum Velocity (High-beta meme, velocity & gaming runners)
  2: new Set([
    'SHIB_USDT', 'PEPE_USDT', 'BONK_USDT', 'FLOKI_USDT', 'WIF_USDT', 'BOME_USDT',
    'MEME_USDT', 'PEOPLE_USDT', 'NOT_USDT', 'TON_USDT', 'GALA_USDT', 'SAND_USDT',
    'MANA_USDT', 'AXS_USDT', 'CHZ_USDT', 'FLOW_USDT', 'DOGS_USDT', '1000BONK_USDT',
    '1000PEPE_USDT', '1000FLOKI_USDT', '1000SHIB_USDT', '1000SATS_USDT', '1000RATS_USDT',
    'NEIRO_USDT', 'TURBO_USDT', 'POPCAT_USDT', 'MEW_USDT', 'BRETT_USDT', 'MYRO_USDT',
    'SLERF_USDT', 'COQ_USDT', 'WEN_USDT'
  ]),
  // 3: DeFi & Layer-1 Vanguard (Decentralized protocols & infrastructure)
  3: new Set([
    'ARB_USDT', 'OP_USDT', 'POL_USDT', 'SUI_USDT', 'APT_USDT', 'INJ_USDT',
    'FTM_USDT', 'ALGO_USDT', 'DYDX_USDT', 'CRV_USDT', 'MKR_USDT', 'SNX_USDT',
    'COMP_USDT', '1INCH_USDT', 'LDO_USDT', 'PENDLE_USDT', 'JUP_USDT', 'ENA_USDT',
    'TIA_USDT', 'SEI_USDT', 'AVAX_USDT', 'KAVA_USDT', 'UNI_USDT', 'SUSHI_USDT',
    'CAKE_USDT', 'RAY_USDT', 'OSMO_USDT', 'STRK_USDT', 'ZK_USDT', 'MANTA_USDT', 'METIS_USDT'
  ]),
  // 4: Alpha Rapid-Scalp (High-turnover volatile scalping runners)
  4: new Set([
    'ORDI_USDT', 'SATS_USDT', 'RATS_USDT', 'KAS_USDT', 'STX_USDT', 'BLUR_USDT',
    'PYTH_USDT', 'JTO_USDT', 'RUNE_USDT', 'AEVO_USDT', 'DYM_USDT', 'PIXEL_USDT',
    'PORTAL_USDT', 'ALT_USDT', 'ONDO_USDT', 'CFX_USDT', 'ETHFI_USDT', 'TNSR_USDT',
    'W_USDT', 'BB_USDT', 'REZ_USDT', 'ZRO_USDT', 'BLAST_USDT', 'DRAM_USDT'
  ]),
  // 5: AI & Cyber Innovators (Artificial Intelligence, compute & cyber runners)
  5: new Set([
    'RENDER_USDT', 'FET_USDT', 'TAO_USDT', 'NEAR_USDT', 'AGIX_USDT', 'OCEAN_USDT',
    'RLC_USDT', 'PHB_USDT', 'AI_USDT', 'NFP_USDT', 'ARK_USDT', 'GLM_USDT',
    'GRT_USDT', 'AR_USDT', 'THETA_USDT', 'WLD_USDT', 'ICP_USDT', 'FIL_USDT',
    'IO_USDT', 'AKT_USDT', 'ATH_USDT', 'AIOZ_USDT', 'LPT_USDT', 'SPEC_USDT', 'NMR_USDT',
    'HYPE_USDT', 'SYRUP_USDT'
  ]),
};

// Toxic coin blacklist derived from empirical trade performance audit
export const TOXIC_COIN_BLACKLIST = new Set([
  'BATON_USDT',
  'Q_USDT',
  'SI_USDT',
  'CENT_USDT',
  'SOCK_USDT',
  'ZCAT_USDT',
  'PENGU_USDT',
  'AKE_USDT',
  'LYN_USDT',
  'CT_USDT',
  'AAVE_USDT',
  'MARSCOIN_USDT',
  'TRIA_USDT',
  'UBIK_USDT',
]);

export function getStaticFallbackTickers(): MexcTicker[] {
  const fallbackSymbolsByGroup = [
    // 0: Apex Cyber-Volatiles
    ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'SUI_USDT', 'DOGE_USDT', 'PEPE_USDT', 'NEAR_USDT', 'AVAX_USDT', 'APT_USDT', 'TIA_USDT', 'RENDER_USDT', 'FET_USDT', 'INJ_USDT', 'SEI_USDT', 'WLD_USDT'],
    // 1: Titan Momentum Core
    ['BNB_USDT', 'XRP_USDT', 'ADA_USDT', 'LINK_USDT', 'DOT_USDT', 'LTC_USDT', 'BCH_USDT', 'XLM_USDT', 'ETC_USDT', 'UNI_USDT', 'ATOM_USDT', 'FIL_USDT', 'ICP_USDT', 'HBAR_USDT', 'VET_USDT'],
    // 2: Quantum Velocity
    ['SHIB_USDT', 'BONK_USDT', 'FLOKI_USDT', 'WIF_USDT', 'BOME_USDT', 'MEME_USDT', 'PEOPLE_USDT', 'NOT_USDT', 'TON_USDT', 'GALA_USDT', 'SAND_USDT', 'MANA_USDT', 'AXS_USDT', 'CHZ_USDT', 'FLOW_USDT'],
    // 3: DeFi & Layer-1 Vanguard
    ['ARB_USDT', 'OP_USDT', 'POL_USDT', 'FTM_USDT', 'ALGO_USDT', 'DYDX_USDT', 'CRV_USDT', 'MKR_USDT', 'SNX_USDT', 'COMP_USDT', '1INCH_USDT', 'LDO_USDT', 'PENDLE_USDT', 'JUP_USDT', 'ENA_USDT'],
    // 4: Alpha Rapid-Scalp
    ['KAS_USDT', 'ORDI_USDT', 'SATS_USDT', 'RATS_USDT', 'STX_USDT', 'BLUR_USDT', 'PYTH_USDT', 'JTO_USDT', 'STRK_USDT', 'ZK_USDT', 'IO_USDT', 'TAO_USDT', 'KAVA_USDT', 'RUNE_USDT', 'AEVO_USDT'],
    // 5: AI & Cyber Innovators
    ['AGIX_USDT', 'OCEAN_USDT', 'RLC_USDT', 'PHB_USDT', 'AI_USDT', 'NFP_USDT', 'ARK_USDT', 'GLM_USDT', 'GRT_USDT', 'AR_USDT', 'THETA_USDT', 'EGLD_USDT', 'EOS_USDT', 'IOTA_USDT', 'XTZ_USDT'],
  ];

  const result: MexcTicker[] = [];

  for (let g = 0; g < ASSET_GROUPS.length; g++) {
    const groupName = ASSET_GROUPS[g].name;
    const symbols = fallbackSymbolsByGroup[g] || fallbackSymbolsByGroup[0];
    symbols.forEach((symbol, idx) => {
      result.push({
        symbol,
        lastPrice: 1.0,
        riseFallRate: 0.01,
        volume24: 100000,
        amount24: 1000000,
        high24Price: 1.05,
        low24Price: 0.95,
        fairPrice: 1.0,
        fundingRate: 0.0001,
        volatilityScore: Math.max(1, 20 - idx * 0.8),
        groupName,
        groupIndex: g,
      });
    });
  }

  return result;
}

/**
 * Filters and groups raw MEXC contract ticker items.
 * Uses adaptive turnover and spread thresholds to ensure sufficient liquidity
 * while guaranteeing all asset groups are populated.
 */
export function filterAndGroupMexcTickers(rawData: any[]): MexcTicker[] {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  // 1. Basic contract validation
  const baseValid = rawData.filter((item: any) => {
    const symbol = item?.symbol;
    if (!symbol || typeof symbol !== 'string' || !symbol.endsWith('_USDT')) return false;

    // Exclude synthetic equity/stock/index tokens that suffer illiquid spreads & weekend gaps
    if (
      symbol.includes('STOCK') ||
      symbol.includes('SOXL') ||
      symbol.includes('INDEX') ||
      symbol.includes('_QQQ') ||
      symbol.includes('_SPY')
    ) {
      return false;
    }

    // Exclude historically audited toxic pairs and non-crypto commodities/equities/forex
    if (TOXIC_COIN_BLACKLIST.has(symbol) || NON_CRYPTO_SYMBOLS.has(symbol)) return false;

    const contractId = Number(item.contractId) || 0;
    const holdVol = Number(item.holdVol) || 0;
    const fundingRate = item.fundingRate;

    // Must be an active futures contract with open interest & funding rate
    if (contractId <= 0 || holdVol <= 0 || fundingRate === undefined || fundingRate === null) {
      return false;
    }

    // Funding rate cap (0.25% per 8h to avoid abnormal short squeeze manipulation)
    const fRate = Math.abs(Number(fundingRate) || 0);
    if (fRate > 0.0025) return false;

    const lastPrice = Number(item.lastPrice) || 0;
    const fairPrice = Number(item.fairPrice) || 0;
    const high24 = Number(item.high24Price) || 0;
    const low24 = Number(item.lower24Price) || 0;

    if (lastPrice <= 0 || fairPrice <= 0 || high24 <= 0 || low24 <= 0) return false;
    if (high24 < low24) return false;
    if (lastPrice > high24 * 1.25 || lastPrice < low24 * 0.75) return false;

    return true;
  });

  if (baseValid.length === 0) {
    return [];
  }

  const targetCount = ASSET_GROUPS.length * 15; // 90 items

  // 2. Adaptive tiered filtering: prefer higher turnover & tighter spreads, gracefully relaxing if needed
  const tiers = [
    { minAmount24: 1_000_000, maxSpread: 0.015 },
    { minAmount24: 500_000, maxSpread: 0.025 },
    { minAmount24: 100_000, maxSpread: 0.04 },
    { minAmount24: 0, maxSpread: 0.08 },
  ];

  let selectedItems: any[] = [];

  for (const tier of tiers) {
    const filtered = baseValid.filter((item: any) => {
      const amount24 = Number(item.amount24) || 0;
      if (amount24 < tier.minAmount24) return false;

      const lastPrice = Number(item.lastPrice) || 1;
      const fairPrice = Number(item.fairPrice) || lastPrice;
      const spread = Math.abs(lastPrice - fairPrice) / lastPrice;
      if (spread > tier.maxSpread) return false;

      return true;
    });

    if (filtered.length >= targetCount) {
      selectedItems = filtered;
      break;
    }
    if (filtered.length > selectedItems.length) {
      selectedItems = filtered;
    }
  }

  if (selectedItems.length === 0) {
    selectedItems = baseValid;
  }

  // 3. Sort by volatility score
  const sorted = selectedItems.map((item: any) => {
    const riseFallRate = Number(item.riseFallRate) || 0;
    const high = Number(item.high24Price) || 0;
    const low = Number(item.lower24Price) || 0;
    const last = Number(item.lastPrice) || 1;
    const rangePct = last > 0 ? ((high - low) / last) * 100 : 0;
    const volatilityScore = Math.abs(riseFallRate * 100) * 1.5 + rangePct;

    return {
      symbol: item.symbol,
      lastPrice: last,
      riseFallRate,
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

  sorted.sort((a, b) => b.volatilityScore - a.volatilityScore);

  // 4. Partition into asset groups
  const groupedTickers: MexcTicker[] = [];
  const groupSize = 15;

  if (sorted.length >= targetCount) {
    const assignedSymbols = new Set<string>();
    const groupBuckets: MexcTicker[][] = Array.from({ length: ASSET_GROUPS.length }, () => []);

    // Group 0: Apex Cyber-Volatiles gets the top 15 highest volatility surge items
    for (const item of sorted) {
      if (groupBuckets[0].length >= groupSize) break;
      groupBuckets[0].push({ ...item, groupName: ASSET_GROUPS[0].name, groupIndex: 0 });
      assignedSymbols.add(item.symbol);
    }

    // Groups 1 to 5: Allocate thematically based on matching coin sectors
    for (let g = 1; g < ASSET_GROUPS.length; g++) {
      const thematicSet = THEMATIC_SETS[g];
      if (thematicSet) {
        for (const item of sorted) {
          if (groupBuckets[g].length >= groupSize) break;
          if (!assignedSymbols.has(item.symbol) && thematicSet.has(item.symbol)) {
            groupBuckets[g].push({ ...item, groupName: ASSET_GROUPS[g].name, groupIndex: g });
            assignedSymbols.add(item.symbol);
          }
        }
      }
    }

    // Fill any remaining slots in groups 1 to 5 from unassigned items sorted by volatility
    for (let g = 1; g < ASSET_GROUPS.length; g++) {
      if (groupBuckets[g].length < groupSize) {
        for (const item of sorted) {
          if (groupBuckets[g].length >= groupSize) break;
          if (!assignedSymbols.has(item.symbol)) {
            groupBuckets[g].push({ ...item, groupName: ASSET_GROUPS[g].name, groupIndex: g });
            assignedSymbols.add(item.symbol);
          }
        }
      }
    }

    for (let g = 0; g < ASSET_GROUPS.length; g++) {
      groupedTickers.push(...groupBuckets[g]);
    }
  } else {
    // If fewer than 90 items, distribute evenly across all groups in round-robin fashion without duplication
    for (let i = 0; i < sorted.length; i++) {
      const g = i % ASSET_GROUPS.length;
      groupedTickers.push({
        ...sorted[i],
        groupName: ASSET_GROUPS[g].name,
        groupIndex: g,
      });
    }
  }

  return groupedTickers;
}

// Module-level in-memory cache to survive transient network or upstream hiccups
let cachedMexcTickers: MexcTicker[] = [];
let lastMexcTickerFetchTime = 0;
const TICKER_CACHE_TTL_MS = 15_000; // 15s fresh TTL

const MEXC_TICKER_ENDPOINTS = [
  'https://contract.mexc.com/api/v1/contract/ticker',
  'https://futures.mexc.com/api/v1/contract/ticker',
];

/**
 * Fetch raw tickers from MEXC Futures REST API with multi-endpoint failover and multi-level fallback
 */
export async function fetchMexcFuturesTickers(forceRefresh = false): Promise<MexcTicker[]> {
  const now = Date.now();
  if (!forceRefresh && cachedMexcTickers.length >= 15 && now - lastMexcTickerFetchTime < TICKER_CACHE_TTL_MS) {
    return cachedMexcTickers;
  }

  let rawData: any[] | null = null;
  let lastFetchError: unknown = null;

  for (const endpoint of MEXC_TICKER_ENDPOINTS) {
    try {
      const res = await fetchWithRetry(endpoint, {
        headers: { Accept: 'application/json' },
      }, 2, 5000);

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          rawData = json.data;
          break;
        }
      }
    } catch (err) {
      lastFetchError = err;
      console.warn(`[MEXC API] Endpoint ${endpoint} failed, trying alternative if available:`, err);
    }
  }

  if (rawData && rawData.length > 0) {
    const processed = filterAndGroupMexcTickers(rawData);
    if (processed.length > 0) {
      cachedMexcTickers = processed;
      lastMexcTickerFetchTime = Date.now();
      return processed;
    }
  }

  // Fallback 1: Return memory cache if available (even if expired)
  if (cachedMexcTickers.length > 0) {
    console.warn(`[MEXC API] Upstream fetch failed or empty (${lastFetchError ? String(lastFetchError) : 'no data'}), returning retained cache of ${cachedMexcTickers.length} tickers.`);
    return cachedMexcTickers;
  }

  // Fallback 2: Bootstrap static fallback tickers so market data is ALWAYS available
  console.warn(`[MEXC API] Upstream fetch failed and no cache exists. Initializing static fallback tickers.`);
  const fallback = getStaticFallbackTickers();
  cachedMexcTickers = fallback;
  lastMexcTickerFetchTime = Date.now();
  return fallback;
}

// ─── High-Throughput 1M Kline In-Memory Cache (10s TTL) ───────────────────
interface KlineCacheEntry {
  candles: Candle[];
  timestamp: number;
}
const klineCache = new Map<string, KlineCacheEntry>();

/**
 * Fetch candles from MEXC Futures REST API with failover endpoints, start/end scoping, and caching
 */
export async function fetchMexcKlines(symbol: string, limit: number = 280, interval: string = 'Min1'): Promise<Candle[]> {
  const cacheKey = `${symbol}_${interval}_${limit}`;
  const cached = klineCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 10000 && cached.candles.length >= 20) {
    return cached.candles;
  }

  const nowSec = Math.floor(now / 1000);
  // Request bounded time range for 1M candles (e.g., 280 mins + 10 min buffer)
  // Reduces payload size from ~200 KB (2,000 candles) down to ~15 KB, eliminating socket saturation
  const startSec = Math.max(0, nowSec - ((limit + 10) * 60));

  const endpoints = [
    `https://contract.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}&start=${startSec}&end=${nowSec}`,
    `https://futures.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}&start=${startSec}&end=${nowSec}`,
    `https://contract.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}`,
    `https://futures.mexc.com/api/v1/contract/kline/${symbol}?interval=${interval}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchWithRetry(url, {
        headers: { Accept: 'application/json' },
      }, 1, 8000);

      if (res.ok) {
        const data = await res.json().catch(() => null);
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
          if (candles.length > 20) {
            klineCache.set(cacheKey, { candles, timestamp: Date.now() });
            return candles;
          }
        }
      }
    } catch (err) {
      console.warn(`[MEXC API] Kline fetch attempt failed for ${symbol} on ${url}:`, err);
    }
  }

  console.error(`[MEXC API] Kline fetch completely failed for ${symbol}`);
  return [];
}


// ─── MEXC Futures Order Execution ──────────────────────────────────────────

const MEXC_CONTRACT_BASE = 'https://contract.mexc.com';

export interface MexcContractMeta {
  contractSize: number;
  apiAllowed: boolean;
  priceScale?: number;
  priceUnit?: number;
}

const contractMetaCache = new Map<string, MexcContractMeta>();
const contractSizeCache = new Map<string, number>();

/**
 * Formats a trigger price strictly according to MEXC contract decimal precision rules
 */
export function formatTriggerPrice(price: number, priceScale?: number): number {
  if (isNaN(price) || price <= 0) return 0;
  if (priceScale !== undefined && priceScale >= 0) {
    return Number(price.toFixed(priceScale));
  }
  // Adaptive heuristic fallback based on price magnitude
  if (price >= 10000) return Number(price.toFixed(1));
  if (price >= 100) return Number(price.toFixed(2));
  if (price >= 1) return Number(price.toFixed(4));
  if (price >= 0.001) return Number(price.toFixed(6));
  return Number(price.toFixed(8));
}

// Server-side: fetches full contract metadata (contractSize, apiAllowed, priceScale) directly from MEXC
export async function fetchMexcContractDetailRemote(symbol: string): Promise<MexcContractMeta | null> {
  const cached = contractMetaCache.get(symbol);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetchWithRetry(`${MEXC_CONTRACT_BASE}/api/v1/contract/detail?symbol=${symbol}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const size = Number(data?.data?.contractSize);
      const apiAllowed = data?.data?.apiAllowed !== false; // false only if explicitly disallow
      const priceScale = data?.data?.priceScale !== undefined ? Number(data?.data?.priceScale) : undefined;
      const priceUnit = data?.data?.priceUnit !== undefined ? Number(data?.data?.priceUnit) : undefined;
      if (data?.success && size > 0) {
        const meta: MexcContractMeta = { contractSize: size, apiAllowed, priceScale, priceUnit };
        contractMetaCache.set(symbol, meta);
        contractSizeCache.set(symbol, size);
        return meta;
      }
    }
  } catch (err) {
    console.warn(`[MEXC API] Contract detail fetch failed for ${symbol}:`, err);
  }
  return null;
}

// Server-side: fetches contract size directly from MEXC
export async function fetchMexcContractSizeRemote(symbol: string): Promise<number | null> {
  const meta = await fetchMexcContractDetailRemote(symbol);
  return meta ? meta.contractSize : null;
}

// Client-side: calls the same-origin proxy route to avoid CORS blocking
export async function fetchMexcContractSize(symbol: string): Promise<number | null> {
  const cached = contractSizeCache.get(symbol);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`/api/mexc/contract?symbol=${encodeURIComponent(symbol)}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const size = Number(data?.contractSize);
      if (size > 0) {
        contractSizeCache.set(symbol, size);
        return size;
      }
    }
  } catch (err) {
    console.warn(`[MEXC API] Contract size proxy fetch failed for ${symbol}:`, err);
  }
  return null;
}

export interface MexcOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type?: number; // 1 = limit, 5 = market (default)
  openType?: number; // 1 = isolated, 2 = cross (default 1 when leverage set)
  leverage?: number;
  vol?: number;
  price?: number;
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
  positionId?: number;
  symbol: string;
  positionType: number; // 1=Long, 2=Short
  openType: number; // 1=isolated, 2=cross
  holdSide: number;
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
 */
export async function mexcAuthRequest(
  apiKey: string,
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  bodyParams: Record<string, string | number> = {}
): Promise<any> {
  const reqTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

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
    const res = await fetchWithRetry(url, options);
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
    const bodyParams: Record<string, string | number> = {
      symbol: params.symbol,
      side: params.side === 'BUY' ? 1 : 3,
      type: Number(params.type || 5), // 5 = market order
      vol: params.vol || 0,
      openType: params.openType || 1, // 1 = isolated, 2 = cross
    };

    if (params.leverage) {
      await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/leverage', {
        symbol: params.symbol,
        leverage: params.leverage,
        positionType: params.side === 'BUY' ? 1 : 2,
      });
      bodyParams.leverage = params.leverage;
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
 * Set Take Profit / Stop Loss on MEXC exchange.
 * Places native Trigger / Plan Orders (/api/v1/private/planorder/place) which are 100% visible
 * on the MEXC platform web/mobile interface under "Trigger Orders / 计划委托 / 止盈止损".
 * Also cancels any outdated plan orders for the symbol to keep orders synced cleanly.
 */
export async function setMexcTPSL(
  apiKey: string,
  secretKey: string,
  symbol: string,
  positionType: 1 | 2, // 1=Long, 2=Short
  stopLossPrice?: number,
  takeProfitPrice?: number,
  vol: number = 1,
  openType: 1 | 2 = 1, // 1=isolated, 2=cross
  tpVol?: number
): Promise<MexcOrderResult> {
  let placedAny = false;
  let lastErr = '';

  try {
    // 0. Fetch contract detail to determine exact exchange price precision (priceScale)
    const meta = await fetchMexcContractDetailRemote(symbol);
    const formattedSl = stopLossPrice && stopLossPrice > 0 ? formatTriggerPrice(stopLossPrice, meta?.priceScale) : undefined;
    const formattedTp = takeProfitPrice && takeProfitPrice > 0 ? formatTriggerPrice(takeProfitPrice, meta?.priceScale) : undefined;

    // 1. Clear previous plan orders and stop orders for this symbol so moving SL/TP doesn't accumulate duplicates
    try {
      await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/planorder/cancel_all', { symbol });
    } catch {
      // Ignore cleanup error if none existed
    }
    try {
      await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/stoporder/cancel_all', { symbol });
    } catch {
      // Ignore cleanup error if none existed
    }

    // 2. Place Stop-Loss Trigger Order on MEXC (visible on MEXC UI under Trigger Orders)
    if (formattedSl && formattedSl > 0) {
      // Long SL triggers when price drops <= stopLossPrice (side: 4 = close long, triggerType: 2 = <=)
      // Short SL triggers when price rises >= stopLossPrice (side: 2 = close short, triggerType: 1 = >=)
      // In MEXC Futures: trend = 1 defines Latest Price as the trigger reference price feed
      const slPayload = {
        symbol,
        side: positionType === 1 ? 4 : 2,
        orderType: 5, // Market execution once triggered
        type: 5,      // Compatible with both v1 and v2 endpoints
        triggerPrice: formattedSl,
        triggerType: positionType === 1 ? 2 : 1,
        trend: 1,     // 1 = Latest Price benchmark
        openType: openType || 1,
        vol,
        executeCycle: 1,
      };

      let slRes = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/planorder/place/v2', slPayload);
      if (!slRes || !slRes.success) {
        slRes = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/planorder/place', slPayload);
      }

      if (slRes && slRes.success) {
        placedAny = true;
      } else {
        lastErr = slRes?.message || 'SL plan order placement failed';
      }
    }

    // 3. Place Take-Profit Trigger Order on MEXC (visible on MEXC UI under Trigger Orders)
    if (formattedTp && formattedTp > 0) {
      // Long TP triggers when price rises >= takeProfitPrice (side: 4 = close long, triggerType: 1 = >=)
      // Short TP triggers when price drops <= takeProfitPrice (side: 2 = close short, triggerType: 2 = <=)
      // In MEXC Futures: trend = 1 defines Latest Price as the trigger reference price feed
      const tpQuantity = tpVol !== undefined && tpVol > 0 ? tpVol : vol;
      const tpPayload = {
        symbol,
        side: positionType === 1 ? 4 : 2,
        orderType: 5, // Market execution once triggered
        type: 5,      // Compatible with both v1 and v2 endpoints
        triggerPrice: formattedTp,
        triggerType: positionType === 1 ? 1 : 2,
        trend: 1,     // 1 = Latest Price benchmark
        openType: openType || 1,
        vol: tpQuantity,
        executeCycle: 1,
      };

      let tpRes = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/planorder/place/v2', tpPayload);
      if (!tpRes || !tpRes.success) {
        tpRes = await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/planorder/place', tpPayload);
      }

      if (tpRes && tpRes.success) {
        placedAny = true;
      } else if (!lastErr) {
        lastErr = tpRes?.message || 'TP plan order placement failed';
      }
    }

    // 4. Also call position stoporder endpoint (/stoporder/place) with Latest Price reference
    try {
      const stoporderPayload: Record<string, any> = {
        symbol,
        positionType,
        openType: openType || 1,
        vol,
        lossTrend: 1,   // 1 = Latest price
        profitTrend: 1, // 1 = Latest price
      };
      if (formattedSl) stoporderPayload.stopLossPrice = formattedSl;
      if (formattedTp) stoporderPayload.takeProfitPrice = formattedTp;
      await mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/stoporder/place', stoporderPayload);
    } catch {
      // Non-blocking fallback since planorder is already placed
    }

    if (placedAny) {
      return { success: true };
    }

    return {
      success: false,
      message: lastErr || 'TP/SL placement failed',
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

  if (result && result.success) {
    if (!Array.isArray(result.data)) {
      return [];
    }
    return result.data.map((p: any) => ({
      positionId: p.positionId ? Number(p.positionId) : undefined,
      symbol: p.symbol,
      positionType: p.positionType,
      openType: Number(p.openType) || 1,
      holdSide: Number(p.holdSide ?? p.positionType) || 0,
      openQty: Number(p.holdVol) || 0,
      availableQty: Number(p.availableVol) || Number(p.holdVol) || 0,
      openPrice: Number(p.openAvgPrice) || 0,
      unrealisedProfit: Number(p.unrealisedProfit) || 0,
      leverage: Number(p.leverage) || 10,
      liquidationPrice: Number(p.liquidationPrice) || 0,
    }));
  }

  if (result?.success === false) {
    throw new Error(result?.message || `MEXC positions error (code ${result?.code})`);
  }

  return [];
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
 * Cancel ALL pending orders for a symbol on MEXC:
 * 1. Open limit/market orders (/api/v1/private/order/cancel_all)
 * 2. Plan/Trigger orders - Take Profit and Stop Loss triggers (/api/v1/private/planorder/cancel_all)
 * 3. Stop orders (/api/v1/private/stoporder/cancel_all)
 */
export async function cancelAllPendingOrders(
  apiKey: string,
  secretKey: string,
  symbol: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const results = await Promise.allSettled([
      mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/order/cancel_all', { symbol }),
      mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/planorder/cancel_all', { symbol }),
      mexcAuthRequest(apiKey, secretKey, 'POST', '/api/v1/private/stoporder/cancel_all', { symbol }),
    ]);

    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason?.message || 'Cancel failed');

    if (errors.length > 0) {
      console.warn(`[MEXC] Partial cancellation warning for ${symbol}:`, errors.join(', '));
    }
    return { success: true };
  } catch (err: any) {
    console.warn(`[MEXC] Error cancelling pending orders for ${symbol}:`, err?.message);
    return { success: false, message: err?.message };
  }
}

/**
 * Close a position (market order) — numeric close sides: 4 = close long, 2 = close short.
 * Automatically cancels all remaining plan orders, trigger orders, and open orders for the symbol.
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

    // Always sweep and cancel any remaining pending/plan/stop orders for this symbol
    await cancelAllPendingOrders(apiKey, secretKey, symbol).catch(() => {});

    if (result && result.success) {
      return { success: true, orderId: result.data?.orderId };
    }
    return {
      success: false,
      code: result?.code,
      message: result?.message || 'Close failed',
    };
  } catch (err: any) {
    // Attempt pending orders cleanup even on error
    await cancelAllPendingOrders(apiKey, secretKey, symbol).catch(() => {});
    return {
      success: false,
      message: err.message || 'Network error',
    };
  }
}
