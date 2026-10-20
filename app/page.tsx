'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { BotConstellation, BotUnit } from '@/components/BotConstellation';
import { ActiveSignalItem } from '@/components/TradingSignalCard';
import { RiskOverviewCard } from '@/components/RiskOverviewCard';
import { PerformanceSummaryCard } from '@/components/PerformanceSummaryCard';
import { MarketScanner } from '@/components/MarketScanner';
import { PositionsView } from '@/components/PositionsView';
import { TradeLogsView } from '@/components/TradeLogsView';
import { CandleChartModal } from '@/components/CandleChartModal';
import { SettingsModal } from '@/components/SettingsModal';
import { MotionGraphicsLogoModal } from '@/components/MotionGraphicsLogoModal';
import {
  MexcTicker,
  MexcPosition,
  TradeLog,
  ASSET_GROUPS,
  OFFICIAL_BOT_UNITS,
  MAX_OPEN_POSITIONS,
} from '@/lib/mexc';
import { mexcWs } from '@/lib/mexc-ws';
import { StrategyConfig, DEFAULT_CONFIG, SignalResult, Candle } from '@/lib/strategy';

export default function Home() {
  // Navigation & State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'positions' | 'logs' | 'settings'>('dashboard');
  const [isAutoTrading, setIsAutoTrading] = useState<boolean>(true);
  const [equity, setEquity] = useState<number>(0);
  const [serverIp, setServerIp] = useState<string>('Detecting...');

  // Settings
  const [apiKey, setApiKey] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [telegramToken, setTelegramToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_CONFIG);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Market & Trading State
  const [tickers, setTickers] = useState<MexcTicker[]>([]);
  const tickersRef = useRef<MexcTicker[]>([]);
  const [scanResults, setScanResults] = useState<Record<string, SignalResult>>({});
  const [positions, setPositions] = useState<MexcPosition[]>([]);
  const positionsRef = useRef<MexcPosition[]>([]);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [activeSignals, setActiveSignals] = useState<ActiveSignalItem[]>([]);
  const [isScanningBatch, setIsScanningBatch] = useState<boolean>(false);
  const executingSymbolsRef = useRef<Set<string>>(new Set());
  const lastAttemptRef = useRef<Map<string, number>>(new Map());

  // Chart Modal
  const [chartSymbol, setChartSymbol] = useState<string>('BTC_USDT');
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);

  // Logo Motion Graphics Grid Breakdown Modal
  const [isLogoMotionModalOpen, setIsLogoMotionModalOpen] = useState<boolean>(false);

  // 8 Official Autonomous Bot Units (Max 8 Positions Co-Active)
  const [bots, setBots] = useState<BotUnit[]>(OFFICIAL_BOT_UNITS.map(b => ({
    ...b,
    status: b.status as 'ACTIVE' | 'SCANNING' | 'HOLDING',
    activeSignalsCount: 2,
  })));
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [viewBotId, setViewBotId] = useState<string | null>(null);

  // Keep positionsRef synced for synchronous checks in async execution
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Sync bot PnL and status from real position data
  useEffect(() => {
    setBots((prevBots) =>
      prevBots.map((bot) => {
        const botPositions = positions.filter((p) => p.botId === bot.id);
        const botPnl = botPositions.reduce((sum, p) => sum + p.realizedPnl + p.unrealizedPnl, 0);
        const hasOpen = botPositions.some((p) => p.status === 'OPEN');
        return {
          ...bot,
          pnl: Number(botPnl.toFixed(2)),
          status: hasOpen ? ('HOLDING' as const) : ('ACTIVE' as const),
          currentSymbol: hasOpen ? botPositions.find((p) => p.status === 'OPEN')?.symbol : undefined,
          tradesCount: botPositions.length,
        };
      })
    );
  }, [positions]);

  // Restore persisted credentials & settings (auto-saved on change below)
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  useEffect(() => {
    try {
      const savedApiKey = localStorage.getItem('monorid-api-key');
      const savedSecretKey = localStorage.getItem('monorid-secret-key');
      const savedTelegramToken = localStorage.getItem('monorid-telegram-token');
      const savedTelegramChatId = localStorage.getItem('monorid-telegram-chat');
      const savedConfig = localStorage.getItem('monorid-config');
      if (savedApiKey) setApiKey(savedApiKey);
      if (savedSecretKey) setSecretKey(savedSecretKey);
      if (savedTelegramToken) setTelegramToken(savedTelegramToken);
      if (savedTelegramChatId) setTelegramChatId(savedTelegramChatId);
      if (savedConfig) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) });
      }
    } catch {
      // localStorage unavailable
    }
    setSettingsHydrated(true);
  }, []);

  // Auto-save credentials & settings whenever they change
  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      localStorage.setItem('monorid-api-key', apiKey);
      localStorage.setItem('monorid-secret-key', secretKey);
      localStorage.setItem('monorid-telegram-token', telegramToken);
      localStorage.setItem('monorid-telegram-chat', telegramChatId);
      localStorage.setItem('monorid-config', JSON.stringify(config));
    } catch {
      // storage unavailable
    }
  }, [settingsHydrated, apiKey, secretKey, telegramToken, telegramChatId, config]);

  // 1. Fetch Server IPv4 Address on mount
  useEffect(() => {
    async function loadServerIp() {
      try {
        const res = await fetch('/api/system/ip');
        if (res.ok) {
          const data = await res.json();
          if (data && data.ip) {
            setServerIp(data.ip);
          }
        }
      } catch {
        setServerIp('Not detected');
      }
    }
    loadServerIp();
  }, []);

  // 1b. Fetch real MEXC account balance (equity) when API credentials are available
  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      if (!apiKey || !secretKey) return;
      try {
        const res = await fetch('/api/mexc/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, secretKey }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && data && data.success && data.balance) {
          const totalEquity = (data.balance.totalEquity || 0) + (data.balance.unrealisedProfit || 0);
          if (totalEquity > 0) {
            setEquity(totalEquity);
          }
        }
      } catch (err) {
        console.warn('[MEXC] Balance fetch failed:', err);
      }
    }

    loadBalance();
    const interval = setInterval(loadBalance, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiKey, secretKey]);

  // 2. Fetch Tickers and Initialize Market Data
  const loadTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/mexc/tickers');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.tickers) && data.tickers.length > 0) {
          tickersRef.current = data.tickers;
          setTickers(data.tickers);
          return data.tickers;
        }
      }
      console.error('[MEXC] Ticker fetch returned empty — market data unavailable');
    } catch (err) {
      console.error('[MEXC] Ticker fetch failed — market data unavailable:', err);
    }
    return [];
  }, []);

  // 3. Scan top volatile symbols for CRUDE OIL BUY/SELL signals with EMA 200 filter
  const runScanner = useCallback(async (currentTickers?: MexcTicker[]) => {
    setIsScanningBatch(true);
    const targetTickers = currentTickers || tickersRef.current;
    if (targetTickers.length === 0) {
      setIsScanningBatch(false);
      return;
    }

    // Pick top 15 highest volatile contracts
    const topSymbols = targetTickers.slice(0, 15).map((t) => t.symbol);

    try {
      const res = await fetch('/api/mexc/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: topSymbols, config }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.results)) {
          const newResults: Record<string, SignalResult> = {};
          const newSignals: ActiveSignalItem[] = [];

          for (const item of data.results) {
            if (item.success && item.analysis) {
              newResults[item.symbol] = item.analysis;
              const t = targetTickers.find((tick) => tick.symbol === item.symbol);
              const groupName = t?.groupName || 'Apex Cyber-Volatiles';

              if (item.analysis.action === 'BUY' || item.analysis.action === 'SELL') {
                newSignals.push({
                  id: `sig-${item.symbol}-${Date.now()}`,
                  symbol: item.symbol,
                  groupName,
                  side: item.analysis.action,
                  price: item.analysis.entryPrice || t?.lastPrice || 100,
                  confidence: Math.min(96, Math.round(85 + (item.analysis.emaFilterOK ? 10 : 0))),
                  leverage: item.analysis.recommendedLeverage || 12,
                  sl: item.analysis.slLevel || (item.analysis.entryPrice || 100) * 0.985,
                  tp1: item.analysis.tp1Level || (item.analysis.entryPrice || 100) * 1.015,
                  tp2: item.analysis.tp2Level || (item.analysis.entryPrice || 100) * 1.03,
                  tp3: item.analysis.tp3Level || (item.analysis.entryPrice || 100) * 1.045,
                  rsi: item.analysis.rsi || 50,
                  emaFilterOK: item.analysis.emaFilterOK || false,
                  timestamp: Date.now(),
                  status: 'ACTIVE',
                  retryCount: 0,
                  analysis: item.analysis,
                });
              }
            }
          }

          setScanResults((prev) => ({ ...prev, ...newResults }));

          setActiveSignals((prevSignals) => {
            const merged = new Map<string, ActiveSignalItem>();
            for (const sig of prevSignals) {
              if (sig.status === 'ACTIVE') merged.set(sig.symbol, sig);
            }
            for (const sig of newSignals) {
              const existing = merged.get(sig.symbol);
              if (existing) {
                merged.set(sig.symbol, {
                  ...sig,
                  retryCount: existing.retryCount,
                  id: existing.id,
                  timestamp: existing.timestamp,
                });
              } else {
                merged.set(sig.symbol, sig);
              }
            }
            for (const [symbol, sig] of merged) {
              const freshAnalysis = newResults[symbol];
              if (freshAnalysis && freshAnalysis.action !== 'BUY' && freshAnalysis.action !== 'SELL') {
                merged.delete(symbol);
              }
            }
            return Array.from(merged.values());
          });
        }
      }
    } catch (err) {
      console.warn('Scanner error:', err);
    } finally {
      setIsScanningBatch(false);
    }
  }, [config]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      const t = await loadTickers();
      if (!isMounted) return;
      runScanner(t);
    };
    initialize();
    return () => {
      isMounted = false;
    };
  }, [loadTickers, runScanner]);

  // Helper to add trade logs
  const addLog = useCallback((entry: Omit<TradeLog, 'id' | 'timestamp'>) => {
    const newLog: TradeLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 99)]);
  }, []);

  // Helper to trigger Telegram Alert
  const sendTelegramAlert = useCallback(async (type: string, pos: MexcPosition, price: number, pnl?: number) => {
    if (!telegramToken || !telegramChatId) return;
    try {
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramToken,
          chatId: telegramChatId,
          type,
          symbol: pos.symbol,
          side: pos.side,
          price,
          sl: pos.slPrice,
          tp1: pos.tp1Price,
          tp2: pos.tp2Price,
          tp3: pos.tp3Price,
          leverage: pos.leverage,
          pnl,
          groupName: pos.groupName,
        }),
      });
    } catch {
      // ignore network errors in background
    }
  }, [telegramToken, telegramChatId]);

  // MEXC Real Order Execution Helpers
  const executeMexcOrder = async (
    symbol: string,
    side: 'BUY' | 'SELL',
    leverage: number,
    vol: number,
    stopLossPrice?: number,
    takeProfitPrice?: number
  ) => {
    try {
      const res = await fetch('/api/mexc/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place',
          symbol,
          side,
          type: 5, // Market order
          leverage,
          vol,
          stopLossPrice,
          takeProfitPrice,
          apiKey,
          secretKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        console.log('[MEXC] Order placed:', data.orderId);
      } else {
        console.warn('[MEXC] Order failed:', data.message);
      }
      return data;
    } catch (err) {
      console.error('[MEXC] Order execution error:', err);
      return { success: false, message: 'Network error' };
    }
  };

  const executeMexcTpsl = async (
    symbol: string,
    positionType: 1 | 2,
    takeProfitPrice?: number,
    stopLossPrice?: number,
    vol: number = 1,
    openType: 1 | 2 = 1
  ) => {
    try {
      const res = await fetch('/api/mexc/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_tpsl',
          symbol,
          positionType,
          takeProfitPrice,
          stopLossPrice,
          vol,
          openType,
          apiKey,
          secretKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        console.log('[MEXC] TP/SL set for', symbol);
      } else {
        console.warn('[MEXC] TP/SL failed:', data.message);
      }
      return data;
    } catch (err) {
      console.error('[MEXC] TP/SL error:', err);
      return { success: false, message: 'Network error' };
    }
  };

  const executeMexcClose = async (
    symbol: string,
    positionType: 1 | 2,
    quantity: number
  ) => {
    try {
      const res = await fetch('/api/mexc/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          symbol,
          positionType,
          quantity,
          apiKey,
          secretKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        console.log('[MEXC] Position closed:', symbol);
      } else {
        console.warn('[MEXC] Close failed:', data.message);
      }
      return data;
    } catch (err) {
      console.error('[MEXC] Close error:', err);
      return { success: false, message: 'Network error' };
    }
  };

  // WebSocket price feed subscriptions for open positions (keyed by symbol so
  // price ticks don't tear down and re-subscribe every stream)
  const openSymbolsKey = positions
    .filter((p) => p.status === 'OPEN')
    .map((p) => p.symbol)
    .sort()
    .join(',');

  useEffect(() => {
    const symbols = openSymbolsKey.split(',').filter(Boolean);
    if (symbols.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    symbols.forEach((symbol) => {
      const unsub = mexcWs.subscribe(symbol, (update) => {
        setPositions((prevPositions) => {
          return prevPositions.map((p) => {
            if (p.symbol !== update.symbol || p.status !== 'OPEN') return p;

            const newPrice = update.price;
            const isLong = p.side === 'LONG';
            const pnlPct = isLong
              ? ((newPrice - p.entryPrice) / p.entryPrice) * p.leverage * 100
              : ((p.entryPrice - newPrice) / p.entryPrice) * p.leverage * 100;
            const unPnl = (p.equityUsed * pnlPct) / 100;

            let updatedPos = { ...p, currentPrice: newPrice, unrealizedPnl: unPnl, unrealizedPnlPct: pnlPct };

            if (!p.tp1Hit && (isLong ? newPrice >= p.tp1Price : newPrice <= p.tp1Price)) {
              updatedPos.tp1Hit = true;
              updatedPos.currentSize = p.initialSize * 0.75;
              const tp1Pnl = p.equityUsed * 0.25 * (p.leverage * (config.rrTp1 * 0.015));
              updatedPos.realizedPnl += tp1Pnl;
              updatedPos.slPrice = p.entryPrice;

              addLog({
                groupName: p.groupName,
                symbol: p.symbol,
                type: 'TP1_HIT',
                side: p.side,
                price: newPrice,
                sizeFraction: '25% Scaled Out',
                pnl: tp1Pnl,
                message: `Target 1 hit at $${newPrice}. 25% position closed, SL set to Break-Even.`,
              });
              sendTelegramAlert('TP1_HIT', p, newPrice, tp1Pnl);

              if (apiKey && secretKey) {
                // Real 25% partial close, then move exchange TP/SL
                // (SL -> break-even, TP -> next target)
                const tp1Qty = Math.floor(p.contractVol * 0.25);
                if (tp1Qty >= 1) {
                  updatedPos.closedVol = p.closedVol + tp1Qty;
                  executeMexcClose(p.symbol, isLong ? 1 : 2, tp1Qty);
                }
                executeMexcTpsl(p.symbol, isLong ? 1 : 2, p.tp2Price, p.entryPrice, Math.max(1, p.contractVol - updatedPos.closedVol));
              }
            }

            if (p.tp1Hit && !p.tp2Hit && (isLong ? newPrice >= p.tp2Price : newPrice <= p.tp2Price)) {
              updatedPos.tp2Hit = true;
              updatedPos.currentSize = p.initialSize * 0.25;
              const tp2Pnl = p.equityUsed * 0.5 * (p.leverage * (config.rrTp2 * 0.015));
              updatedPos.realizedPnl += tp2Pnl;

              addLog({
                groupName: p.groupName,
                symbol: p.symbol,
                type: 'TP2_HIT',
                side: p.side,
                price: newPrice,
                sizeFraction: '50% Scaled Out',
                pnl: tp2Pnl,
                message: `Target 2 hit at $${newPrice}. 50% position closed.`,
              });
              sendTelegramAlert('TP2_HIT', p, newPrice, tp2Pnl);

              if (apiKey && secretKey) {
                const tp2Qty = Math.floor(p.contractVol * 0.5);
                if (tp2Qty >= 1) {
                  updatedPos.closedVol = p.closedVol + tp2Qty;
                  executeMexcClose(p.symbol, isLong ? 1 : 2, tp2Qty);
                }
              }
            }

            if (p.tp2Hit && !p.tp3Hit && (isLong ? newPrice >= p.tp3Price : newPrice <= p.tp3Price)) {
              updatedPos.tp3Hit = true;
              updatedPos.currentSize = 0;
              updatedPos.status = 'CLOSED';
              updatedPos.closeReason = 'TP3';
              const tp3Pnl = updatedPos.realizedPnl;

              addLog({
                groupName: p.groupName,
                symbol: p.symbol,
                type: 'TP3_HIT',
                side: p.side,
                price: newPrice,
                sizeFraction: '100% Full Exit',
                pnl: tp3Pnl,
                message: `Target 3 reached at $${newPrice}. Full position completed!`,
              });
              sendTelegramAlert('TP3_HIT', p, newPrice, tp3Pnl);

              if (apiKey && secretKey) {
                const remaining = p.contractVol - p.closedVol;
                if (remaining >= 1) executeMexcClose(p.symbol, isLong ? 1 : 2, remaining);
              }
            }

            if ((isLong && newPrice <= p.slPrice) || (!isLong && newPrice >= p.slPrice)) {
              updatedPos.slHit = true;
              updatedPos.currentSize = 0;
              updatedPos.status = 'CLOSED';
              updatedPos.closeReason = 'SL';
              const slPnl = unPnl;

              addLog({
                groupName: p.groupName,
                symbol: p.symbol,
                type: 'SL_HIT',
                side: p.side,
                price: newPrice,
                pnl: slPnl,
                message: `Stop Loss executed at $${newPrice}. Capital preserved.`,
              });
              sendTelegramAlert('SL_HIT', p, newPrice, slPnl);

              if (apiKey && secretKey) {
                const remaining = p.contractVol - p.closedVol;
                if (remaining >= 1) executeMexcClose(p.symbol, isLong ? 1 : 2, remaining);
              }
            }

            return updatedPos;
          });
        });
      });

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [openSymbolsKey, config, apiKey, secretKey, addLog, sendTelegramAlert]);

  // Automated Trade Execution Pipeline (Enforces MAX 8 Open Positions together)
  const autoExecuteConfirmedTrade = useCallback(async (
    symbol: string,
    side: 'BUY' | 'SELL',
    analysis: SignalResult,
    ticker?: MexcTicker
  ): Promise<boolean> => {
    if (equity <= 0) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'SCAN_SIGNAL',
        side: 'INFO',
        price: ticker?.lastPrice || 0,
        message: `Trade on ${symbol} skipped: No MEXC account balance loaded. Add API credentials in Settings.`,
      });
      return false;
    }

    const tradePrice = analysis.entryPrice || ticker?.lastPrice || 100;
    const lev = analysis.recommendedLeverage || 12;
    const tradeEquity = equity * (config.equityRiskPct / 100); // 10% equity

    // Convert USDT notional into MEXC contract volume (vol is denominated in contracts)
    // Use server-side API route to avoid CORS issues
    let contractSize: number | null = null;
    try {
      const contractRes = await fetch(`/api/mexc/contract?symbol=${symbol}`);
      const contractData = await contractRes.json();
      if (contractData.success) {
        contractSize = contractData.contractSize;
      }
    } catch (err) {
      console.warn('[MEXC] Contract size fetch failed:', err);
    }
    if (!contractSize) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'SCAN_SIGNAL',
        side: 'INFO',
        price: tradePrice,
        message: `Trade on ${symbol} skipped: contract size unavailable from MEXC.`,
      });
      return false;
    }
    const contractVol = Math.floor((tradeEquity * lev) / (contractSize * tradePrice));
    if (contractVol < 1) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'SCAN_SIGNAL',
        side: 'INFO',
        price: tradePrice,
        message: `Trade on ${symbol} skipped: notional below MEXC minimum contract size (needs ${Math.ceil((contractSize * tradePrice) / (lev || 1))}+ USDT margin).`,
      });
      return false;
    }

    // Check position limits synchronously from ref
    const currentPositions = positionsRef.current;
    const activeCount = currentPositions.filter((p) => p.status === 'OPEN').length;

    if (activeCount >= MAX_OPEN_POSITIONS) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'SCAN_SIGNAL',
        side: 'INFO',
        price: ticker?.lastPrice || 0,
        message: `MAX POSITIONS LIMIT REACHED (8/8). Trade on ${symbol} skipped to preserve risk ceiling.`,
      });
      return false;
    }

    if (currentPositions.some((p) => p.status === 'OPEN' && p.symbol === symbol)) {
      return true; // Already open, counts as "handled"
    }

    // Find an available idle bot
    const activeBotIds = new Set(
      currentPositions.filter((p) => p.status === 'OPEN').map((p) => p.botId)
    );
    const availableBot = bots.find((b) => !activeBotIds.has(b.id)) || bots[0];

    const riskDist = analysis.riskDist || tradePrice * 0.015;

    const slPrice = analysis.slLevel || (side === 'BUY' ? tradePrice - riskDist : tradePrice + riskDist);
    const tp1Price = analysis.tp1Level || (side === 'BUY' ? tradePrice + riskDist * config.rrTp1 : tradePrice - riskDist * config.rrTp1);
    const tp2Price = analysis.tp2Level || (side === 'BUY' ? tradePrice + riskDist * config.rrTp2 : tradePrice - riskDist * config.rrTp2);
    const tp3Price = analysis.tp3Level || (side === 'BUY' ? tradePrice + riskDist * config.rrTp3 : tradePrice - riskDist * config.rrTp3);

    const groupName = ticker?.groupName || 'Apex Cyber-Volatiles';

    const newPosition: MexcPosition = {
      id: `pos-${symbol}-${Date.now()}`,
      symbol,
      groupName,
      botId: availableBot.id,
      botCode: availableBot.name.replace('Monorid ', ''),
      botName: availableBot.name.replace('Monorid ', ''),
      side: side === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice: tradePrice,
      currentPrice: tradePrice,
      leverage: lev,
      initialSize: tradeEquity,
      currentSize: tradeEquity,
      equityUsed: tradeEquity,
      contractVol,
      closedVol: 0,
      slPrice: Number(slPrice.toFixed(6)),
      tp1Price: Number(tp1Price.toFixed(6)),
      tp2Price: Number(tp2Price.toFixed(6)),
      tp3Price: Number(tp3Price.toFixed(6)),
      tp1Hit: false,
      tp2Hit: false,
      tp3Hit: false,
      slHit: false,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      realizedPnl: 0,
      status: 'OPEN',
      createdAt: Date.now(),
    };

    // Update ref immediately so next async call sees this position
    positionsRef.current = [newPosition, ...currentPositions];

    // Update bot status to HOLDING
    setBots((prevBots) =>
      prevBots.map((b) =>
        b.id === availableBot.id ? { ...b, status: 'HOLDING', currentSymbol: symbol } : b
      )
    );

    const botDisplayName = availableBot.name.replace('Monorid ', '');

    // Add log with bot attribution
    addLog({
      groupName,
      botCode: botDisplayName,
      botName: botDisplayName,
      symbol,
      type: 'ENTRY',
      side: newPosition.side,
      price: tradePrice,
      sizeFraction: `Slot ${activeCount + 1}/8 (10% Equity • ${lev}x • ${contractVol} Contracts)`,
      message: `[AUTO-EXECUTION] ${botDisplayName} triggered ${newPosition.side} on CRUDE OIL 3M signal (EMA 200 confirmed). SL: $${slPrice.toFixed(4)}, TP1: $${tp1Price.toFixed(4)}, TP2: $${tp2Price.toFixed(4)}, TP3: $${tp3Price.toFixed(4)}.`,
    });

    // Send Telegram alert
    sendTelegramAlert('ENTRY', newPosition, tradePrice);

    // Execute real order on MEXC
    if (apiKey && secretKey) {
      executeMexcOrder(symbol, side, lev, contractVol, slPrice, tp3Price).then((result) => {
        if (!result.success) {
          console.warn('[MEXC] Order rejected:', result.message);
          setPositions((prev) => {
            const filtered = prev.filter((p) => p.id !== newPosition.id);
            positionsRef.current = filtered;
            return filtered;
          });
          setBots((prevBots) =>
            prevBots.map((b) =>
              b.id === availableBot.id ? { ...b, status: 'ACTIVE', currentSymbol: undefined } : b
            )
          );
          addLog({
            groupName,
            symbol,
            type: 'SCAN_SIGNAL',
            side: 'INFO',
            price: tradePrice,
            message: `[AUTO-REVERT] ${botDisplayName} position on ${symbol} reverted — MEXC order failed: ${result.message}. Slot freed.`,
          });
        } else {
          // Order succeeded — wait briefly for position to fill, then set TP/SL on exchange automatically
          const positionType = side === 'BUY' ? 1 : 2; // 1=Long, 2=Short
          setTimeout(() => {
            executeMexcTpsl(symbol, positionType, tp3Price, slPrice, contractVol, 1).then((tpslResult) => {
              if (tpslResult.success) {
                console.log('[MEXC] TP/SL set automatically for', symbol);
                addLog({
                  groupName,
                  symbol,
                  type: 'ENTRY',
                  side: newPosition.side,
                  price: tradePrice,
                  message: `[AUTO-TP/SL] Exchange TP/SL set: SL=$${slPrice.toFixed(4)}, TP=$${tp3Price.toFixed(4)} for ${contractVol} contracts.`,
                });
              } else {
                console.warn('[MEXC] TP/SL setup failed:', tpslResult.message);
                addLog({
                  groupName,
                  symbol,
                  type: 'ENTRY',
                  side: newPosition.side,
                  price: tradePrice,
                  message: `[WARNING] TP/SL setup failed on exchange: ${tpslResult.message}. Client-side monitoring active.`,
                });
              }
            });
          }, 1500); // Wait 1.5s for position to fill on exchange
        }
      });
    }

    setPositions(positionsRef.current);
    return true;
  }, [bots, equity, config, addLog, sendTelegramAlert, apiKey, secretKey]);

  // Auto-execute confirmed scanner signals while AUTO TRADING is enabled
  const MAX_SIGNAL_RETRIES = 3;
  const SIGNAL_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  const RETRY_COOLDOWN_MS = 25000; // 25s between retries (one scan cycle)

  useEffect(() => {
    if (!isAutoTrading || !apiKey || !secretKey) return;

    const now = Date.now();
    const toRemove = new Set<string>();
    const toExecute: ActiveSignalItem[] = [];

    for (const sig of activeSignals) {
      if (sig.status !== 'ACTIVE') {
        toRemove.add(sig.symbol);
        continue;
      }
      if (sig.retryCount >= MAX_SIGNAL_RETRIES) {
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'SCAN_SIGNAL',
          side: 'INFO',
          price: sig.price,
          message: `Trade on ${sig.symbol} failed after ${MAX_SIGNAL_RETRIES} retries. Signal removed.`,
        });
        continue;
      }
      if (now - sig.timestamp > SIGNAL_EXPIRY_MS) {
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'SCAN_SIGNAL',
          side: 'INFO',
          price: sig.price,
          message: `Signal on ${sig.symbol} expired after ${Math.round((now - sig.timestamp) / 1000)}s (retries: ${sig.retryCount}/${MAX_SIGNAL_RETRIES}).`,
        });
        continue;
      }
      if (executingSymbolsRef.current.has(sig.symbol)) continue;

      const lastAttempt = lastAttemptRef.current.get(sig.symbol) || 0;
      if (now - lastAttempt < RETRY_COOLDOWN_MS) continue;

      const analysis = sig.analysis || scanResults[sig.symbol];
      if (!analysis || (analysis.action !== 'BUY' && analysis.action !== 'SELL')) {
        toRemove.add(sig.symbol);
        continue;
      }

      toExecute.push(sig);
    }

    if (toRemove.size > 0) {
      setActiveSignals((prev) => prev.filter((s) => !toRemove.has(s.symbol)));
    }

    for (const sig of toExecute) {
      executingSymbolsRef.current.add(sig.symbol);
      lastAttemptRef.current.set(sig.symbol, now);
      const ticker = tickers.find((t) => t.symbol === sig.symbol);
      const analysis = sig.analysis || scanResults[sig.symbol];
      if (!analysis || (analysis.action !== 'BUY' && analysis.action !== 'SELL')) {
        executingSymbolsRef.current.delete(sig.symbol);
        continue;
      }

      autoExecuteConfirmedTrade(sig.symbol, analysis.action, analysis, ticker)
        .then((success) => {
          if (success) {
            setActiveSignals((prev) =>
              prev.map((s) => s.symbol === sig.symbol ? { ...s, status: 'EXECUTED' as const } : s)
            );
            setTimeout(() => {
              setActiveSignals((prev) => prev.filter((s) => s.symbol !== sig.symbol));
            }, 2000);
          } else {
            setActiveSignals((prev) =>
              prev.map((s) =>
                s.symbol !== sig.symbol ? s : { ...s, retryCount: s.retryCount + 1 }
              )
            );
          }
        })
        .finally(() => {
          executingSymbolsRef.current.delete(sig.symbol);
        });
    }
  }, [activeSignals, isAutoTrading, scanResults, tickers, autoExecuteConfirmedTrade, apiKey, secretKey, addLog]);

  // 4. Periodic re-sync: reconcile local positions with real MEXC exchange state
  useEffect(() => {
    if (!apiKey || !secretKey) return;

    const syncFromExchange = async () => {
      try {
        const res = await fetch('/api/mexc/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'positions', apiKey, secretKey }),
        });
        const payload = await res.json();
        const raw = Array.isArray(payload?.data) ? payload.data : [];

        const exchangeSymbols = new Set(raw.map((p: any) => p.symbol).filter(Boolean));

        const contractSizes = new Map<string, number>();
        for (const p of raw) {
          if (p.symbol && !contractSizes.has(p.symbol)) {
            try {
              const contractRes = await fetch(`/api/mexc/contract?symbol=${p.symbol}`);
              const contractData = await contractRes.json();
              if (contractData.success && contractData.contractSize) {
                contractSizes.set(p.symbol, contractData.contractSize);
              }
            } catch (err) {
              console.warn(`[MEXC] Contract size fetch failed for ${p.symbol}:`, err);
            }
          }
        }

        setPositions((prev) => {
          const kept = prev.filter((p) => p.status === 'OPEN' && exchangeSymbols.has(p.symbol));
          const keptSymbols = new Set(kept.map((p) => p.symbol));
          const removed = prev.filter((p) => p.status === 'OPEN' && !keptSymbols.has(p.symbol));

          const takenBotIds = new Set(kept.filter((p) => p.botId).map((p) => p.botId));
          const seeded: MexcPosition[] = [];
          for (const p of raw) {
            if (keptSymbols.has(p.symbol)) continue;
            const entry = Number(p.openPrice) || 0;
            const vol = Number(p.openQty) || 0;
            const lev = Number(p.leverage) || 10;
            const side: 'LONG' | 'SHORT' = p.positionType === 1 ? 'LONG' : 'SHORT';
            if (!p.symbol || entry <= 0 || vol <= 0) continue;

            const contractSize = contractSizes.get(p.symbol) || 0;
            const equityUsed = contractSize ? (vol * contractSize * entry) / lev : 0;
            const riskDist = entry * 0.015;
            const isLong = side === 'LONG';
            const r = (n: number) => Number(n.toFixed(6));
            const apiPnl = Number(p.unrealisedProfit) || 0;
            const pnlPct = equityUsed > 0 ? (apiPnl / equityUsed) * 100 : 0;

            const freeBot = OFFICIAL_BOT_UNITS.find((b) => !takenBotIds.has(b.id)) || OFFICIAL_BOT_UNITS[0];
            takenBotIds.add(freeBot.id);
            const label = freeBot.name.replace('Monorid ', '');

            seeded.push({
              id: `sync-${p.symbol}-${Date.now()}`,
              symbol: p.symbol,
              groupName: 'Resynced (Exchange)',
              botId: freeBot.id,
              botCode: label,
              botName: label,
              side,
              entryPrice: entry,
              currentPrice: entry,
              leverage: lev,
              initialSize: equityUsed,
              currentSize: equityUsed,
              equityUsed,
              contractVol: vol,
              closedVol: 0,
              slPrice: r(isLong ? entry - riskDist : entry + riskDist),
              tp1Price: r(isLong ? entry + riskDist * config.rrTp1 : entry - riskDist * config.rrTp1),
              tp2Price: r(isLong ? entry + riskDist * config.rrTp2 : entry - riskDist * config.rrTp2),
              tp3Price: r(isLong ? entry + riskDist * config.rrTp3 : entry - riskDist * config.rrTp3),
              tp1Hit: false, tp2Hit: false, tp3Hit: false, slHit: false,
              unrealizedPnl: apiPnl,
              unrealizedPnlPct: pnlPct,
              realizedPnl: 0,
              status: 'OPEN',
              createdAt: Date.now(),
            });
            keptSymbols.add(p.symbol);
          }

          const next = [...kept, ...seeded];
          positionsRef.current = next;

          if (removed.length > 0) {
            addLog({
              groupName: 'Risk Engine',
              symbol: removed.map((p) => p.symbol).join(', '),
              type: 'SCAN_SIGNAL',
              side: 'INFO',
              price: 0,
              message: `Sync removed ${removed.length} phantom position(s) not found on MEXC exchange.`,
            });
          }
          if (seeded.length > 0) {
            addLog({
              groupName: 'Risk Engine',
              symbol: seeded.map((s) => s.symbol).join(', '),
              type: 'SCAN_SIGNAL',
              side: 'INFO',
              price: seeded[0].entryPrice,
              message: `Sync restored ${seeded.length} position(s) from MEXC exchange.`,
            });
          }
          return next;
        });

        setBots((prevBots) =>
          prevBots.map((b) => {
            const botPos = positionsRef.current.find((p) => p.botId === b.id && p.status === 'OPEN');
            if (botPos) return { ...b, status: 'HOLDING' as const, currentSymbol: botPos.symbol };
            if (b.status === 'HOLDING') return { ...b, status: 'ACTIVE' as const, currentSymbol: undefined };
            return b;
          })
        );
      } catch (err) {
        console.warn('[MEXC] Position re-sync failed:', err);
      }
    };

    syncFromExchange();
    const interval = setInterval(syncFromExchange, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, secretKey]);

  // 5. Background Automated 24/7 Scanning Loop
  useEffect(() => {
    const scanInterval = setInterval(() => {
      runScanner();
    }, 25000);

    return () => {
      clearInterval(scanInterval);
    };
  }, [runScanner]);

  // Inspect Candle Chart Modal
  const handleOpenChart = async (symbol: string) => {
    setChartSymbol(symbol);
    setIsChartModalOpen(true);

    try {
      const res = await fetch(`/api/mexc/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [symbol], config }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results[0] && Array.isArray(data.results[0].candles)) {
          setChartCandles(data.results[0].candles);
          return;
        }
      }
    } catch (err) {
      console.error('[MEXC] Chart candle fetch failed:', err);
    }
    setChartCandles([]);
  };

  // Manual Position Close
  const handleClosePosition = (id: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          addLog({
            groupName: p.groupName,
            symbol: p.symbol,
            type: 'ENTRY',
            side: p.side,
            price: p.currentPrice,
            pnl: p.unrealizedPnl,
            message: `Manually closed ${p.symbol} position. Final P&L: $${p.unrealizedPnl.toFixed(2)}.`,
          });
          // Execute real close on MEXC (remaining contracts)
          if (apiKey && secretKey) {
            const remaining = p.contractVol - p.closedVol;
            if (remaining >= 1) {
              executeMexcClose(p.symbol, p.side === 'LONG' ? 1 : 2, remaining);
            }
          }
          return { ...p, status: 'CLOSED', closeReason: 'MANUAL' };
        }
        return p;
      })
    );
  };

  // Emergency Panic Flatten
  const handleEmergencyFlatten = () => {
    if (apiKey && secretKey) {
      positions
        .filter((p) => p.status === 'OPEN')
        .forEach((p) => {
          const remaining = p.contractVol - p.closedVol;
          if (remaining >= 1) {
            executeMexcClose(p.symbol, p.side === 'LONG' ? 1 : 2, remaining);
          }
        });
    }
    setPositions((prev) =>
      prev.map((p) => {
        if (p.status === 'OPEN') {
          return { ...p, status: 'CLOSED', closeReason: 'MANUAL' };
        }
        return p;
      })
    );
    addLog({
      groupName: 'ALL GROUPS',
      symbol: 'PANIC_FLATTEN',
      type: 'SL_HIT',
      side: 'INFO',
      price: 0,
      message: 'EMERGENCY FLATTEN TRIGGERED: All open futures positions closed immediately.',
    });
  };

  // Test MEXC Auth in Settings
  const testMexcAuth = async () => {
    const res = await fetch('/api/mexc/test-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, secretKey }),
    });
    return await res.json();
  };

  // Test Telegram Alert in Settings
  const testTelegramAlert = async () => {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: telegramToken, chatId: telegramChatId, test: true }),
    });
    return await res.json();
  };

  // Calculate live portfolio metrics from real trade data
  const openPositionsCount = positions.filter((p) => p.status === 'OPEN').length;
  const marginUsed = positions
    .filter((p) => p.status === 'OPEN')
    .reduce((sum, p) => sum + p.equityUsed, 0);

  const closedPositions = positions.filter((p) => p.status === 'CLOSED');
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const totalUnrealizedPnl = positions
    .filter((p) => p.status === 'OPEN')
    .reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const computedTodayPnl = totalRealizedPnl + totalUnrealizedPnl;
  const totalTrades = openPositionsCount;
  const winningTrades = closedPositions.filter((p) => p.realizedPnl > 0);
  const winRate = closedPositions.length > 0 ? (winningTrades.length / closedPositions.length) * 100 : 0;
  const grossProfit = winningTrades.reduce((sum, p) => sum + p.realizedPnl, 0);
  const grossLoss = Math.abs(closedPositions.filter((p) => p.realizedPnl < 0).reduce((sum, p) => sum + p.realizedPnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  const maxDrawdownPct = equity > 0 ? (Math.max(0, grossLoss) / equity) * 100 : 0;
  const portfolioRiskPct = equity > 0 ? (marginUsed / equity) * 100 : 0;
  const todayPnlPct = equity > 0 ? (computedTodayPnl / equity) * 100 : 0;
  const totalBotPnl = computedTodayPnl;

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      {/* 1. Futuristic Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setViewBotId(null);
          setActiveTab(tab);
        }}
        isAutoTrading={isAutoTrading}
        setIsAutoTrading={setIsAutoTrading}
        equity={equity}
        todayPnl={Number(computedTodayPnl.toFixed(2))}
        openPositionsCount={openPositionsCount}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onEmergencyFlatten={handleEmergencyFlatten}
        serverIp={serverIp}
        onOpenGridBreakdown={() => setIsLogoMotionModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full space-y-5">
        {/* TAB 1: DASHBOARD (Cybernetic Hub matching user's reference image) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Top Grid: Bot Constellation Core (Left) | Risk Overview (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Central Bot Constellation Hub */}
              <div className="lg:col-span-8 flex flex-col justify-center">
                <BotConstellation
                  bots={bots}
                  activeBotId={selectedBotId}
                  onSelectBot={(id) => setSelectedBotId(id)}
                  isAutoTrading={isAutoTrading}
                  totalPnl={Number(totalBotPnl.toFixed(2))}
                  openPositionsCount={openPositionsCount}
                  onOpenLiveTrades={() => {
                    setViewBotId(null);
                    setActiveTab('positions');
                  }}
                  onOpenBotWork={(botId) => {
                    setViewBotId(botId);
                    setActiveTab('positions');
                  }}
                />
              </div>

              {/* Right Column: Risk Management & Performance Summary (fills same height as constellation) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="flex-1">
                  <RiskOverviewCard
                    equity={equity}
                    marginUsed={marginUsed}
                    portfolioRiskPct={Number(portfolioRiskPct.toFixed(2))}
                    maxDrawdownPct={Number(maxDrawdownPct.toFixed(2))}
                    activePositionsCount={openPositionsCount}
                  />
                </div>
                <div className="flex-1">
                  <PerformanceSummaryCard
                    todayPnl={Number(computedTodayPnl.toFixed(2))}
                    todayPnlPct={Number(todayPnlPct.toFixed(2))}
                    winRate={Number(winRate.toFixed(1))}
                    profitFactor={Number(profitFactor.toFixed(2))}
                    totalTrades={totalTrades}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARKET SCANNER (75 Contracts in 5 Groups of 15) */}
        {activeTab === 'scanner' && (
          <MarketScanner
            tickers={tickers}
            scanResults={scanResults}
            onViewChart={handleOpenChart}
            onRefreshScan={() => runScanner()}
            isScanningBatch={isScanningBatch}
          />
        )}

        {/* TAB 3: POSITIONS & TP/SL PROGRESS */}
        {activeTab === 'positions' && (
          <PositionsView
            positions={positions}
            onClosePosition={handleClosePosition}
            onViewChart={handleOpenChart}
            filterBotId={viewBotId}
            filterBotName={viewBotId ? bots.find((b) => b.id === viewBotId)?.name : undefined}
            onClearBotFilter={() => setViewBotId(null)}
          />
        )}

        {/* TAB 4: TRADE LOGS AUDIT */}
        {activeTab === 'logs' && (
          <TradeLogsView
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        )}
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-slate-900 bg-[#04060d] px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-white font-black tracking-widest">MONORID</span>
            <span>•</span>
            <span>Autonomous MEXC Futures High-Frequency System</span>
          </div>

          <div className="text-center sm:text-right text-slate-400">
            Copyright and developed by <span className="text-cyan-400 font-bold">Trading Lifestyle Quant</span>
          </div>
        </div>
      </footer>

      {/* Candlestick & Target Modal */}
      <CandleChartModal
        symbol={chartSymbol}
        isOpen={isChartModalOpen}
        onClose={() => setIsChartModalOpen(false)}
        candles={chartCandles}
        analysis={scanResults[chartSymbol]}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        serverIp={serverIp}
        apiKey={apiKey}
        setApiKey={setApiKey}
        secretKey={secretKey}
        setSecretKey={setSecretKey}
        telegramToken={telegramToken}
        setTelegramToken={setTelegramToken}
        telegramChatId={telegramChatId}
        setTelegramChatId={setTelegramChatId}
        config={config}
        setConfig={setConfig}
        onTestMexcAuth={testMexcAuth}
        onTestTelegram={testTelegramAlert}
      />

      {/* Miro Logo Animation & Grid Breakdown Modal */}
      <MotionGraphicsLogoModal
        isOpen={isLogoMotionModalOpen}
        onClose={() => setIsLogoMotionModalOpen(false)}
      />
    </div>
  );
}
