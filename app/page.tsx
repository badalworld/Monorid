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
  getStaticFallbackTickers,
  extractOrderFeeAndFunding,
  deduplicateClosedPositions,
  reconstructStrategyTargets,
  MIN_AVAILABLE_BALANCE_USDT,
} from '@/lib/mexc';
import { mexcWs } from '@/lib/mexc-ws';
import { StrategyConfig, DEFAULT_CONFIG, SignalResult, Candle } from '@/lib/strategy';

function formatPrice(p: number | undefined): string {
  if (p === undefined || isNaN(p) || p === 0) return '0.00';
  if (Math.abs(p) < 0.0001) return p.toFixed(8);
  if (Math.abs(p) < 0.01) return p.toFixed(6);
  if (Math.abs(p) < 1) return p.toFixed(4);
  return p.toFixed(2);
}

export default function Home() {
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigation & State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'positions' | 'logs' | 'settings'>('dashboard');
  const [isAutoTrading, setIsAutoTrading] = useState<boolean>(true);
  const [equity, setEquity] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
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
  const [lastScanDurationMs, setLastScanDurationMs] = useState<number>(1800);
  const executingSymbolsRef = useRef<Set<string>>(new Set());
  const lastAttemptRef = useRef<Map<string, number>>(new Map());
  const executedTpsRef = useRef<Set<string>>(new Set());
  const [pnlHistory, setPnlHistory] = useState<number[]>([]);
  const [lossCooldowns, setLossCooldowns] = useState<Map<string, number>>(new Map());
  const lossCooldownsRef = useRef<Map<string, number>>(lossCooldowns);

  // Restore client-side persisted state after initial hydration pass (guarantees 100% SSR match)
  useEffect(() => {
    try {
      const savedPos = localStorage.getItem('monorid_positions');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (Array.isArray(parsed)) {
          const deduplicated = deduplicateClosedPositions(parsed);
          setPositions(deduplicated);
          positionsRef.current = deduplicated;
        }
      }
      const savedLogs = localStorage.getItem('monorid_logs');
      if (savedLogs) setLogs(JSON.parse(savedLogs));

      const savedPnl = localStorage.getItem('monorid_pnl_history');
      if (savedPnl) setPnlHistory(JSON.parse(savedPnl));

      const savedCooldowns = localStorage.getItem('monorid_loss_cooldowns');
      if (savedCooldowns) {
        const obj = JSON.parse(savedCooldowns);
        const map = new Map<string, number>();
        const now = Date.now();
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'number' && v > now) map.set(k, v);
        }
        setLossCooldowns(map);
        lossCooldownsRef.current = map;
      }

      // Asynchronously fetch and hydrate persistent trade history and logs from the online server
      (async () => {
        try {
          const [tradesRes, logsRes] = await Promise.all([
            fetch('/api/storage/trades').catch(() => null),
            fetch('/api/storage/logs').catch(() => null),
          ]);

          let serverTrades: MexcPosition[] = [];
          if (tradesRes && tradesRes.ok) {
            const tradesData = await tradesRes.json().catch(() => null);
            if (tradesData && tradesData.success && Array.isArray(tradesData.trades)) {
              serverTrades = tradesData.trades;
            }
          }

          if (serverTrades.length > 0) {
            setPositions((prev) => {
              const merged = deduplicateClosedPositions([...prev, ...serverTrades]);
              positionsRef.current = merged;
              return merged;
            });
          }

          let serverLogs: TradeLog[] = [];
          if (logsRes && logsRes.ok) {
            const logsData = await logsRes.json().catch(() => null);
            if (logsData && logsData.success && Array.isArray(logsData.logs)) {
              serverLogs = logsData.logs;
            }
          }

          if (serverLogs.length > 0) {
            setLogs((prev) => {
              const seenIds = new Set<string>();
              const seenSigs = new Set<string>();
              const merged: TradeLog[] = [];
              for (const l of [...prev, ...serverLogs]) {
                if (!l) continue;
                const sig = `${l.timestamp || 0}|${l.symbol || ''}|${l.type || ''}|${(l.message || '').slice(0, 50)}`;
                const id = l.id || `log-${sig}`;
                if (seenIds.has(id) || seenSigs.has(sig)) continue;
                seenIds.add(id);
                seenSigs.add(sig);
                merged.push({ ...l, id });
              }
              merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              return merged.slice(0, 1000);
            });
          }
        } catch (serverErr) {
          console.warn('[Storage] Failed to hydrate from server persistence:', serverErr);
        }
      })();
    } catch (err) {
      console.warn('Failed to hydrate state from localStorage:', err);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    lossCooldownsRef.current = lossCooldowns;
    try {
      const obj: Record<string, number> = {};
      for (const [k, v] of lossCooldowns.entries()) {
        if (v > Date.now()) obj[k] = v;
      }
      localStorage.setItem('monorid_loss_cooldowns', JSON.stringify(obj));
    } catch (err) {
      console.warn('Failed to persist loss cooldowns:', err);
    }
  }, [lossCooldowns, mounted]);

  // Track repeated losses within 4 hours to escalate cooldown duration
  const lossCountsRef = useRef<Map<string, { count: number; lastLoss: number }>>(new Map());

  // Helper to trigger a 30-minute cooldown on a symbol after a Stop Loss (90m on 2nd+ repeat loss)
  const triggerLossCooldown = useCallback((symbol: string, reason: string = 'Stop Loss Hit') => {
    const now = Date.now();
    const existing = lossCountsRef.current.get(symbol);
    const count = existing && now - existing.lastLoss < 4 * 3600 * 1000 ? existing.count + 1 : 1;
    lossCountsRef.current.set(symbol, { count, lastLoss: now });

    const cooldownMs = count > 1 ? 90 * 60 * 1000 : 30 * 60 * 1000;
    const expiresAt = now + cooldownMs;
    setLossCooldowns((prev) => {
      const next = new Map(prev);
      next.set(symbol, expiresAt);
      return next;
    });
    console.log(`[Cooldown Activated] ${symbol} cooling down for ${cooldownMs / 60000}m (Loss #${count}: ${reason}). Entries banned until ${new Date(expiresAt).toLocaleTimeString()}`);
  }, []);

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
      // Only restore if non-empty (reject empty strings)
      if (savedApiKey && savedApiKey.trim()) setApiKey(savedApiKey);
      if (savedSecretKey && savedSecretKey.trim()) setSecretKey(savedSecretKey);
      if (savedTelegramToken) setTelegramToken(savedTelegramToken);
      if (savedTelegramChatId) setTelegramChatId(savedTelegramChatId);
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          // Auto-migrate legacy strategy parameters to Monorid defaults
          if (!parsed.channelLength) parsed.channelLength = DEFAULT_CONFIG.channelLength;
          if (!parsed.averageLength) parsed.averageLength = DEFAULT_CONFIG.averageLength;
          if (parsed.obLevel2 === undefined) parsed.obLevel2 = DEFAULT_CONFIG.obLevel2;
          if (parsed.osLevel2 === undefined) parsed.osLevel2 = DEFAULT_CONFIG.osLevel2;
          if (!parsed.emaLength) parsed.emaLength = DEFAULT_CONFIG.emaLength;
          if (!parsed.riskRewardRatio) parsed.riskRewardRatio = DEFAULT_CONFIG.riskRewardRatio;
          if (!parsed.rrTp1) parsed.rrTp1 = DEFAULT_CONFIG.rrTp1;
          if (parsed.minConfidence === undefined || parsed.minConfidence < 80) parsed.minConfidence = DEFAULT_CONFIG.minConfidence;
          if (parsed.maxLeverage && parsed.maxLeverage > 8) parsed.maxLeverage = 8;
          const merged = { ...DEFAULT_CONFIG, ...parsed };
          setConfig(merged);
          localStorage.setItem('monorid-config', JSON.stringify(merged));
        } catch {
          setConfig(DEFAULT_CONFIG);
        }
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

  // Load starting balance from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('monorid_starting_balance');
    if (saved) {
      setStartingBalance(parseFloat(saved));
    }
  }, []);

  // Persist positions to localStorage whenever they change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('monorid_positions', JSON.stringify(positions));
    } catch (err) {
      console.warn('Failed to save positions to localStorage:', err);
    }
  }, [positions, mounted]);

  // Persist logs to localStorage whenever they change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('monorid_logs', JSON.stringify(logs));
    } catch (err) {
      console.warn('Failed to save logs to localStorage:', err);
    }
  }, [logs, mounted]);

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
          const avail = Number(data.balance.availableBalance) || 0;
          setAvailableBalance(avail);
          const totalEquity = (data.balance.totalEquity || 0) + (data.balance.unrealisedProfit || 0);
          if (totalEquity > 0) {
            setEquity(totalEquity);
            // Set starting balance only if not already persisted in localStorage
            const savedBalance = localStorage.getItem('monorid_starting_balance');
            if (!savedBalance) {
              setStartingBalance(totalEquity);
              localStorage.setItem('monorid_starting_balance', totalEquity.toString());
            }
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

  // Log equity state for debugging
  useEffect(() => {
    console.log('[Equity] Current balance:', equity, 'API keys set:', !!apiKey && !!secretKey);
  }, [equity, apiKey, secretKey]);

  // Continuous server-side trade history persistence helper
  const persistTradesToServer = useCallback(async (
    target: MexcPosition[] | MexcPosition,
    action: 'append' | 'sync' | 'save' = 'sync'
  ) => {
    try {
      const payload = Array.isArray(target) ? { action, trades: target } : { action: 'append', trade: target };
      await fetch('/api/storage/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[Storage] Failed to persist trades to server:', err);
    }
  }, []);

  // Pending log buffer for continuous asynchronous server-side persistence
  const pendingLogsRef = useRef<TradeLog[]>([]);
  const isFlushingLogsRef = useRef<boolean>(false);

  const flushLogsToServer = useCallback(async () => {
    if (isFlushingLogsRef.current || pendingLogsRef.current.length === 0) return;
    isFlushingLogsRef.current = true;
    const batch = [...pendingLogsRef.current];
    pendingLogsRef.current = [];

    try {
      await fetch('/api/storage/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append', logs: batch }),
      });
    } catch (err) {
      console.warn('[Storage] Failed to flush logs to server, requeueing:', err);
      pendingLogsRef.current = [...batch, ...pendingLogsRef.current];
    } finally {
      isFlushingLogsRef.current = false;
    }
  }, []);

  // Periodic flush every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      flushLogsToServer();
    }, 1000);
    return () => clearInterval(timer);
  }, [flushLogsToServer]);

  // Flush remaining logs on window beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingLogsRef.current.length > 0) {
        const payload = JSON.stringify({ action: 'append', logs: pendingLogsRef.current });
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon('/api/storage/logs', new Blob([payload], { type: 'application/json' }));
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Helper to add trade logs (immediately updates UI & enqueues to server storage)
  const addLog = useCallback((entry: Omit<TradeLog, 'id' | 'timestamp'>) => {
    const newLog: TradeLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 999)]);
    pendingLogsRef.current.push(newLog);
    if (
      pendingLogsRef.current.length >= 10 ||
      entry.type === 'TRADE_EXECUTED' ||
      entry.type === 'TP_HIT' ||
      entry.type === 'SL_HIT' ||
      entry.type === 'MONORID_RUNNING' ||
      entry.type === 'MONORID_STOP'
    ) {
      flushLogsToServer();
    }
  }, [flushLogsToServer]);

  // Track logged opportunities & eliminated reasons to prevent log spamming every 30s
  const loggedOpportunitiesRef = useRef<Set<string>>(new Set());
  const loggedEliminatedRef = useRef<Set<string>>(new Set());
  const isAutoTradingInitialRef = useRef<boolean>(true);

  // Comprehensive Event Logging: Monorid Running and Monorid Stop lifecycle
  useEffect(() => {
    if (!mounted) return;
    if (isAutoTradingInitialRef.current) {
      isAutoTradingInitialRef.current = false;
      addLog({
        groupName: 'SYSTEM',
        symbol: 'AUTOTRADE',
        type: isAutoTrading ? 'MONORID_RUNNING' : 'MONORID_STOP',
        side: 'INFO',
        price: 0,
        message: isAutoTrading
          ? 'Monorid Running: Autonomous 24/7 trading engine activated. Scanning and execution cycles engaged.'
          : 'Monorid Stop: Autonomous trading engine is currently paused.',
      });
      return;
    }

    if (isAutoTrading) {
      addLog({
        groupName: 'SYSTEM',
        symbol: 'AUTOTRADE',
        type: 'MONORID_RUNNING',
        side: 'INFO',
        price: 0,
        message: 'Monorid Running: Autonomous trading engine started by operator. 24/7 scanning and order execution active.',
      });
    } else {
      addLog({
        groupName: 'SYSTEM',
        symbol: 'AUTOTRADE',
        type: 'MONORID_STOP',
        side: 'INFO',
        price: 0,
        message: 'Monorid Stop: Autonomous trading engine paused by operator. Live position tracking remains active.',
      });
    }
  }, [isAutoTrading, mounted, addLog]);

  // 2. Fetch Tickers and Initialize Market Data
  const loadTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/mexc/tickers');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.tickers) && data.tickers.length > 0) {
          tickersRef.current = data.tickers;
          setTickers(data.tickers);
          return data.tickers;
        }
      }

      // Fallback 1: Preserve existing tickers if available
      if (tickersRef.current && tickersRef.current.length > 0) {
        console.warn(`[MEXC] Ticker fetch returned empty/status ${res?.status || 'unknown'}, preserving ${tickersRef.current.length} existing tickers`);
        return tickersRef.current;
      }

      // Fallback 2: Bootstrap static fallback tickers so market data is ALWAYS available
      console.warn('[MEXC] Ticker fetch empty and no cache exists. Initializing static fallback tickers.');
      const fallback = getStaticFallbackTickers();
      tickersRef.current = fallback;
      setTickers(fallback);
      return fallback;
    } catch (err) {
      if (tickersRef.current && tickersRef.current.length > 0) {
        console.warn(`[MEXC] Ticker fetch threw error, preserving ${tickersRef.current.length} existing tickers:`, err);
        return tickersRef.current;
      }
      console.warn('[MEXC] Ticker fetch failed and no cache exists. Initializing static fallback tickers:', err);
      const fallback = getStaticFallbackTickers();
      tickersRef.current = fallback;
      setTickers(fallback);
      return fallback;
    }
  }, []);

  // 3. Scan top volatile symbols for Monorid signals (Green Dot > EMA 200 / Red Dot < EMA 200)
  const runScanner = useCallback(async (currentTickers?: MexcTicker[]) => {
    setIsScanningBatch(true);
    
    // Always refresh ticker list if none passed, or use active/fallback tickers
    let targetTickers: MexcTicker[] = (currentTickers && currentTickers.length > 0) ? currentTickers : [];
    if (targetTickers.length === 0) {
      const freshTickers = await loadTickers();
      if (freshTickers && freshTickers.length > 0) {
        targetTickers = freshTickers;
      } else if (tickersRef.current && tickersRef.current.length > 0) {
        targetTickers = tickersRef.current;
      } else {
        targetTickers = getStaticFallbackTickers();
        tickersRef.current = targetTickers;
        setTickers(targetTickers);
      }
    }
    
    if (targetTickers.length === 0) {
      console.warn('[Scanner] No tickers available - cannot scan');
      setIsScanningBatch(false);
      return;
    }


    // Scan ALL active contracts across all groups (chunked by group for real-time progress logging)
    const allSymbols = targetTickers.map((t) => t.symbol);
    console.log(`[Scanner] Scanning ${allSymbols.length} contracts across all ${ASSET_GROUPS.length} groups`);

    // Comprehensive Event Logging: Market scan cycle initiated
    addLog({
      groupName: 'ALL GROUPS',
      symbol: 'MARKET_SCAN',
      type: 'MARKET_SCAN',
      side: 'INFO',
      price: 0,
      message: `Market scan cycle initiated: scanning ${allSymbols.length} contracts across ${ASSET_GROUPS.length} groups on 1M timeframe.`,
    });

    try {
      // Partition target tickers by group to provide real-time progress logging
      const groupMap = new Map<string, MexcTicker[]>();
      for (const t of targetTickers) {
        const g = t.groupName || 'Apex Cyber-Volatiles';
        if (!groupMap.has(g)) groupMap.set(g, []);
        groupMap.get(g)!.push(t);
      }

      const allAccumulatedResults: Record<string, SignalResult> = {};
      const allAccumulatedSignals: ActiveSignalItem[] = [];
      let totalEliminated = 0;
      let scannedSoFar = 0;

      const groupEntries = Array.from(groupMap.entries());
      const scanStartTime = Date.now();

      // Controlled Concurrent Batches (2 groups per batch) to prevent socket starvation and CDN rate limits
      const groupResponses: Array<{ success: boolean; groupName: string; groupTickers: MexcTicker[]; groupSymbols: string[]; data: any; gIdx: number }> = [];
      const BATCH_SIZE = 2;
      for (let i = 0; i < groupEntries.length; i += BATCH_SIZE) {
        const batch = groupEntries.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async ([groupName, groupTickers], bOffset) => {
          const gIdx = i + bOffset;
          const groupSymbols = groupTickers.map((t) => t.symbol);
          try {
            const res = await fetch('/api/mexc/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: groupSymbols, config }),
            });

            if (res.ok) {
              const data = await res.json();
              return { success: true, groupName, groupTickers, groupSymbols, data, gIdx };
            }
          } catch (groupErr) {
            console.warn(`[Scanner] Group scan failed for ${groupName}:`, groupErr);
          }
          return { success: false, groupName, groupTickers, groupSymbols, data: null, gIdx };
        });

        const batchResults = await Promise.all(batchPromises);
        groupResponses.push(...batchResults);
      }

      const scanDuration = Date.now() - scanStartTime;
      setLastScanDurationMs(scanDuration);

      for (const grp of groupResponses) {
        if (!grp.success || !grp.data || !Array.isArray(grp.data.results)) continue;
        let groupOpportunitiesCount = 0;

        for (const item of grp.data.results) {
          if (item.success && item.analysis) {
            allAccumulatedResults[item.symbol] = item.analysis;
            const t = grp.groupTickers.find((tick) => tick.symbol === item.symbol);

            if (item.analysis.action === 'BUY' || item.analysis.action === 'SELL') {
              groupOpportunitiesCount++;
              const tpTarget = item.analysis.tpLevel ?? item.analysis.tp1Level ?? (item.analysis.action === 'BUY' ? (item.analysis.entryPrice || 100) * 1.03 : (item.analysis.entryPrice || 100) * 0.97);
              const slTarget = item.analysis.slLevel ?? (item.analysis.action === 'BUY' ? (item.analysis.entryPrice || 100) * 0.985 : (item.analysis.entryPrice || 100) * 1.015);

              allAccumulatedSignals.push({
                id: `sig-${item.symbol}-${Date.now()}`,
                symbol: item.symbol,
                groupName: grp.groupName,
                side: item.analysis.action,
                price: item.analysis.entryPrice || t?.lastPrice || 100,
                confidence: item.analysis.confidence ?? 0,
                leverage: item.analysis.recommendedLeverage || 7,
                sl: slTarget,
                tp1: tpTarget,
                tp2: tpTarget,
                tp3: tpTarget,
                rsi: item.analysis.rsi || 50,
                timestamp: Date.now(),
                status: 'ACTIVE',
                retryCount: 0,
                analysis: item.analysis,
              });

              // Comprehensive Event Logging: New Opportunity Detected
              const oppKey = `${item.symbol}-${item.analysis.action}-${Math.floor(Date.now() / 60000)}`;
              if (!loggedOpportunitiesRef.current.has(oppKey)) {
                loggedOpportunitiesRef.current.add(oppKey);
                addLog({
                  groupName: grp.groupName,
                  symbol: item.symbol,
                  type: 'NEW_OPPORTUNITY',
                  side: item.analysis.action === 'BUY' ? 'LONG' : 'SHORT',
                  price: item.analysis.entryPrice || t?.lastPrice || 0,
                  message: `New Opportunity: ${item.symbol} (${item.analysis.action === 'BUY' ? 'LONG' : 'SHORT'}) | Entry: $${formatPrice(item.analysis.entryPrice || 0)} | EMA 200: $${formatPrice(item.analysis.ema)} | WT1: ${item.analysis.wt1.toFixed(1)} | WT2: ${item.analysis.wt2.toFixed(1)} (${(item.analysis.monoridDot || item.analysis.cipherDot)} Dot) | SL: $${formatPrice(slTarget)} (EMA 200) | 1:2 TP: $${formatPrice(tpTarget)} | Conviction: ${item.analysis.confidence}%.`,
                });
              }
            } else if (item.analysis.eliminatedReason) {
              totalEliminated++;
              // Comprehensive Event Logging: Eliminated Opportunity (filtered by technical rule)
              const elimKey = `${item.symbol}-${item.analysis.eliminatedReason.substring(0, 25)}-${Math.floor(Date.now() / 120000)}`;
              if (!loggedEliminatedRef.current.has(elimKey)) {
                loggedEliminatedRef.current.add(elimKey);
                addLog({
                  groupName: grp.groupName,
                  symbol: item.symbol,
                  type: 'ELIMINATED_OPPORTUNITY',
                  side: 'INFO',
                  price: item.analysis.entryPrice || t?.lastPrice || 0,
                  message: `Eliminated Opportunity: ${item.symbol} rejected — ${item.analysis.eliminatedReason}.`,
                });
              }
            }
          }
        }

        scannedSoFar += grp.groupSymbols.length;

        // Comprehensive Event Logging: Market scan progress update
        addLog({
          groupName: grp.groupName,
          symbol: 'MARKET_SCAN',
          type: 'MARKET_SCAN',
          side: 'INFO',
          price: 0,
          message: `Market scan progress: Group ${grp.gIdx + 1}/${groupEntries.length} (${grp.groupName}) completed — ${scannedSoFar}/${allSymbols.length} contracts scanned (${groupOpportunitiesCount} opportunities found).`,
        });
      }

      // Update state with all accumulated results
      setScanResults((prev) => ({ ...prev, ...allAccumulatedResults }));

      // Comprehensive Event Logging: Market scan cycle completed
      addLog({
        groupName: 'ALL GROUPS',
        symbol: 'MARKET_SCAN',
        type: 'MARKET_SCAN',
        side: 'INFO',
        price: 0,
        message: `Market scan cycle completed: ${allSymbols.length} contracts analyzed across ${groupEntries.length} groups. ${allAccumulatedSignals.length} opportunities detected, ${totalEliminated} eliminated.`,
      });

      console.log('[Scanner] Found', allAccumulatedSignals.length, 'BUY/SELL signals from', Object.keys(allAccumulatedResults).length, 'scanned contracts');
      if (allAccumulatedSignals.length > 0) {
        console.log('[Scanner] Signals:', allAccumulatedSignals.map(s => `${s.symbol}:${s.side}`).join(', '));
      }

      setActiveSignals((prevSignals) => {
        const merged = new Map<string, ActiveSignalItem>();
        for (const sig of prevSignals) {
          if (sig.status === 'ACTIVE') merged.set(sig.symbol, sig);
        }
        for (const sig of allAccumulatedSignals) {
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
        const now = Date.now();
        for (const [symbol, sig] of merged) {
          const freshAnalysis = allAccumulatedResults[symbol];
          if (
            (freshAnalysis && freshAnalysis.action !== 'BUY' && freshAnalysis.action !== 'SELL') ||
            now - sig.timestamp > 60 * 1000
          ) {
            merged.delete(symbol);
          }
        }
        return Array.from(merged.values());
      });
    } catch (err) {
      console.error('[Scanner] Batch scan exception:', err);
    } finally {
      setIsScanningBatch(false);
    }
  }, [config, addLog, loadTickers]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      let t = await loadTickers();
      // If initial load returned empty (e.g. server startup / cold compilation), retry once after a short delay
      if ((!t || t.length === 0) && isMounted) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!isMounted) return;
        t = await loadTickers();
      }
      if (!isMounted) return;
      if (t && t.length > 0) {
        runScanner(t);
      }
    };
    initialize();
    return () => {
      isMounted = false;
    };
  }, [loadTickers, runScanner]);




  // Helper to trigger Telegram Alert
  const sendTelegramAlert = useCallback(async (type: string, pos: MexcPosition, price: number, pnl?: number, candleTiming?: string) => {
    if (!telegramToken || !telegramChatId) return;
    try {
      const res = await fetch('/api/telegram', {
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
          candleTiming,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        console.warn(`[Telegram Alert Failed for ${pos.symbol}]:`, data?.error || res.statusText);
      }
    } catch (err) {
      console.warn(`[Telegram Alert Network Error for ${pos.symbol}]:`, err);
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
    openType: 1 | 2 = 1,
    tpVol?: number
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
          tpVol,
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

  // Sweep and cancel all pending orders (limit orders, plan orders, stop loss orders) for a symbol on MEXC
  const executeCancelPendingOrders = useCallback(async (symbol: string) => {
    if (!apiKey || !secretKey) return;
    try {
      const res = await fetch('/api/mexc/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_all',
          symbol,
          apiKey,
          secretKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        console.log(`[MEXC] Cancelled all pending orders for ${symbol}`);
      }
    } catch (err) {
      console.warn(`[MEXC] Failed to cancel pending orders for ${symbol}:`, err);
    }
  }, [apiKey, secretKey]);

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
      // Ensure all plan orders, trigger orders, and open orders are also cancelled immediately
      executeCancelPendingOrders(symbol);
      if (data.success) {
        console.log('[MEXC] Position closed & pending orders cancelled:', symbol);
      } else {
        console.warn('[MEXC] Close failed:', data.message);
      }
      return data;
    } catch (err) {
      executeCancelPendingOrders(symbol);
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
            // Defensive validation: discard missing, zero, negative, or corrupt price ticks
            if (!newPrice || typeof newPrice !== 'number' || isNaN(newPrice) || newPrice <= 0) return p;
            // Discard single-tick flash crash / flash spike anomalies (>90% drop or >1000% spike)
            if (p.entryPrice > 0 && (newPrice < p.entryPrice * 0.1 || newPrice > p.entryPrice * 10)) {
              console.warn(`[Tick] Discarding anomalous price tick for ${p.symbol}: ${newPrice} vs entry ${p.entryPrice}`);
              return p;
            }

            const isLong = p.side === 'LONG';
            const pnlPct = isLong
              ? ((newPrice - p.entryPrice) / p.entryPrice) * p.leverage * 100
              : ((p.entryPrice - newPrice) / p.entryPrice) * p.leverage * 100;
            const unPnl = (p.equityUsed * pnlPct) / 100;

            let updatedPos = { ...p, currentPrice: newPrice, unrealizedPnl: unPnl, unrealizedPnlPct: pnlPct };

            const movePct = isLong
              ? (newPrice - p.entryPrice) / p.entryPrice
              : (p.entryPrice - newPrice) / p.entryPrice;

            const reachedTp = isLong
              ? (p.tp1Price > p.entryPrice && newPrice >= p.tp1Price && newPrice > p.entryPrice)
              : (p.tp1Price < p.entryPrice && p.tp1Price > 0 && newPrice <= p.tp1Price && newPrice < p.entryPrice);

            const reachedSl = isLong
              ? (p.slPrice < p.entryPrice && p.slPrice > 0 && newPrice <= p.slPrice && newPrice < p.entryPrice)
              : (p.slPrice > p.entryPrice && newPrice >= p.slPrice && newPrice > p.entryPrice);

            // For paper/demo positions without exchange order, close locally upon target hit
            // For live positions with active exchange TP/SL plan orders, the exchange matching engine natively executes and syncFromExchange reconciles
            if (!p.orderId) {
              const tpKey = `${p.id}-TP1`;
              if (!p.tp1Hit && !executedTpsRef.current.has(tpKey) && reachedTp) {
                executedTpsRef.current.add(tpKey);
                updatedPos.tp1Hit = true;
                updatedPos.tp2Hit = true;
                updatedPos.tp3Hit = true;
                updatedPos.currentSize = 0;
                updatedPos.status = 'CLOSED';
                updatedPos.closeReason = 'TP1';
                updatedPos.exitPrice = newPrice;
                updatedPos.closedAt = Date.now();
                updatedPos.closedVol = p.contractVol;
                updatedPos.unrealizedPnl = 0;
                updatedPos.unrealizedPnlPct = 0;
                const tpPnl = p.equityUsed * movePct * p.leverage;
                updatedPos.realizedPnl += tpPnl;
                updatedPos.realizedPnlPct = p.equityUsed > 0 ? (updatedPos.realizedPnl / p.equityUsed) * 100 : 0;
                const estFee = Number(((p.equityUsed * p.leverage) * 0.0008).toFixed(4));
                updatedPos.fee = estFee;
                updatedPos.fundingFee = 0;
                updatedPos.netRealizedPnl = Number((updatedPos.realizedPnl - estFee).toFixed(4));

                addLog({
                  groupName: p.groupName,
                  symbol: p.symbol,
                  type: 'TP_HIT',
                  side: p.side,
                  price: newPrice,
                  sizeFraction: '100% Full Exit (1:2 Target)',
                  pnl: updatedPos.realizedPnl,
                  fee: updatedPos.fee,
                  fundingFee: 0,
                  netPnl: updatedPos.netRealizedPnl,
                  message: `Take Profit 1:2 Hit: ${p.symbol} (${p.side}) reached target $${newPrice < 1 ? newPrice.toFixed(6) : newPrice.toFixed(4)}. Realized Profit: +$${updatedPos.realizedPnl.toFixed(2)} (Net: +$${updatedPos.netRealizedPnl.toFixed(2)}, Fee: -$${estFee.toFixed(4)}).`,
                });
                sendTelegramAlert('TP1_HIT', p, newPrice, updatedPos.realizedPnl);
                persistTradesToServer(updatedPos, 'append');
              }

              const slKey = `${p.id}-SL`;
              if (!p.slHit && !executedTpsRef.current.has(slKey) && reachedSl) {
                executedTpsRef.current.add(slKey);
                updatedPos.slHit = true;
                updatedPos.currentSize = 0;
                updatedPos.status = 'CLOSED';
                updatedPos.closeReason = 'SL';
                updatedPos.exitPrice = newPrice;
                updatedPos.closedAt = Date.now();
                updatedPos.closedVol = p.contractVol;
                updatedPos.unrealizedPnl = 0;
                updatedPos.unrealizedPnlPct = 0;
                const remainingFraction = p.contractVol > 0 ? Math.max(0, (p.contractVol - updatedPos.closedVol) / p.contractVol) : 1.0;
                const slPnl = (p.equityUsed * remainingFraction) * movePct * p.leverage;
                updatedPos.realizedPnl += slPnl;
                updatedPos.realizedPnlPct = p.equityUsed > 0 ? (updatedPos.realizedPnl / p.equityUsed) * 100 : 0;
                const estFee = Number(((p.equityUsed * p.leverage) * 0.0008).toFixed(4));
                updatedPos.fee = estFee;
                updatedPos.fundingFee = 0;
                updatedPos.netRealizedPnl = Number((updatedPos.realizedPnl - estFee).toFixed(4));

                triggerLossCooldown(p.symbol, 'Stop Loss Hit');

                addLog({
                  groupName: p.groupName,
                  symbol: p.symbol,
                  type: 'SL_HIT',
                  side: p.side,
                  price: newPrice,
                  pnl: slPnl,
                  fee: updatedPos.fee,
                  fundingFee: 0,
                  netPnl: updatedPos.netRealizedPnl,
                  message: `Stop Loss Hit: ${p.symbol} (${p.side}) executed at $${newPrice < 1 ? newPrice.toFixed(6) : newPrice.toFixed(4)}. Realized Loss: -$${Math.abs(slPnl).toFixed(2)} (Net: -$${Math.abs(updatedPos.netRealizedPnl).toFixed(2)}, Fee: -$${estFee.toFixed(4)}). Post-loss cooldown activated on ${p.symbol}.`,
                });
                sendTelegramAlert('SL_HIT', p, newPrice, slPnl);
                persistTradesToServer(updatedPos, 'append');
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
  }, [openSymbolsKey, config, apiKey, secretKey, addLog, sendTelegramAlert, persistTradesToServer]);

  // Automated Trade Execution Pipeline - Executes trades when candles close (every 1 minute)
  const autoExecuteConfirmedTrade = useCallback(async (
    symbol: string,
    side: 'BUY' | 'SELL',
    analysis: SignalResult,
    ticker?: MexcTicker
  ): Promise<boolean> => {
    console.log('[Trade] Attempting to execute', side, 'on', symbol, 'equity=', equity, 'availableBalance=', availableBalance);
    
    const currentAvail = availableBalance !== null ? availableBalance : equity;
    if (currentAvail < MIN_AVAILABLE_BALANCE_USDT || equity < MIN_AVAILABLE_BALANCE_USDT) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: ticker?.lastPrice || 0,
        message: `Trade skipped: Available balance ($${currentAvail.toFixed(2)}) is below minimum safety threshold ($${MIN_AVAILABLE_BALANCE_USDT.toFixed(2)}).`,
      });
      console.warn(`[Trade] BLOCKED: available balance ($${currentAvail.toFixed(2)}) < $${MIN_AVAILABLE_BALANCE_USDT.toFixed(2)}`);
      return false;
    }

    const tradePrice = analysis.entryPrice || ticker?.lastPrice || 100;
    const lev = Math.min(Math.max(analysis.recommendedLeverage || 7, config.minLeverage || 6), config.maxLeverage || 8);
    const tradeEquity = equity * (config.equityRiskPct / 100); // Sized to equity risk

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
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: tradePrice,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — contract size specification unavailable from MEXC.`,
      });
      return false;
    }
    const contractVol = Math.floor((tradeEquity * lev) / (contractSize * tradePrice));
    if (contractVol < 1) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: tradePrice,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — notional below MEXC minimum contract size (needs ${Math.ceil((contractSize * tradePrice) / (lev || 1))}+ USDT margin).`,
      });
      return false;
    }

    // Trade Confidence Score Filter: ONLY execute trades with confidence score >= minConfidence (default 80%)
    const minConf = config.minConfidence || 80;
    const confidenceScore = analysis.confidence ?? 0;
    if (confidenceScore < minConf) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: tradePrice,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — Confidence score ${confidenceScore}% < ${minConf}% threshold. High-conviction execution policy enforced.`,
      });
      return false;
    }

    // 30-Minute Post-Loss Cooldown Check: prevents repeat churning of stopped-out coins
    const cooldownUntil = lossCooldownsRef.current.get(symbol);
    if (cooldownUntil && cooldownUntil > Date.now()) {
      const remainingMin = Math.ceil((cooldownUntil - Date.now()) / 60000);
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: tradePrice,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — Asset in post-loss cooldown (${remainingMin}m remaining) to protect capital after previous Stop Loss.`,
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
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: ticker?.lastPrice || 0,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — MAX POSITIONS LIMIT REACHED (${MAX_OPEN_POSITIONS}/${MAX_OPEN_POSITIONS}). Preserving risk ceiling.`,
      });
      return false;
    }

    const existingPos = currentPositions.find((p) => p.status === 'OPEN' && p.symbol === symbol);
    if (existingPos) {
      addLog({
        groupName: ticker?.groupName || 'Risk Engine',
        symbol,
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: tradePrice,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — Position already open in portfolio (${existingPos.side} at $${formatPrice(existingPos.entryPrice)}). Preserving risk ceiling of 1 position per coin.`,
      });
      return true; // Already open, counts as "handled"
    }

    const groupName = ticker?.groupName || 'Apex Cyber-Volatiles';

    // Find an available idle bot: prioritize bot assigned to this group, otherwise any idle bot
    const activeBotIds = new Set(
      currentPositions.filter((p) => p.status === 'OPEN').map((p) => p.botId)
    );
    const availableBot =
      bots.find((b) => b.assignedGroup === groupName && !activeBotIds.has(b.id)) ||
      bots.find((b) => !activeBotIds.has(b.id)) ||
      bots[0];

    const calculatedSl = analysis.slLevel || (side === 'BUY' ? tradePrice * 0.985 : tradePrice * 1.015);
    const riskDist = analysis.riskDist || Math.abs(tradePrice - calculatedSl);
    const calculatedTp = analysis.tpLevel || (side === 'BUY' ? tradePrice + riskDist * (config.riskRewardRatio || 2.0) : tradePrice - riskDist * (config.riskRewardRatio || 2.0));

    if (calculatedTp <= 0 || calculatedSl <= 0) {
      addLog({
        groupName,
        symbol,
        type: 'ELIMINATED_OPPORTUNITY',
        side: 'INFO',
        price: tradePrice,
        message: `Eliminated Opportunity: Trade on ${symbol} skipped — Negative TP/SL risk calculation (SL: $${calculatedSl.toFixed(4)}, TP: $${calculatedTp.toFixed(4)}).`,
      });
      return false;
    }

    const decimals = tradePrice < 0.0001 ? 8 : tradePrice < 0.01 ? 7 : tradePrice < 1 ? 6 : tradePrice < 100 ? 4 : 2;
    let slPrice = Number(calculatedSl.toFixed(decimals));
    let tpPrice = Number(calculatedTp.toFixed(decimals));

    // Strict validation: TP must be favorable and SL must be adverse compared to entry
    if (side === 'BUY') {
      if (tpPrice <= tradePrice) {
        tpPrice = Number((tradePrice + Math.max(riskDist * (config.riskRewardRatio || 2.0), tradePrice * 0.03)).toFixed(decimals));
      }
      if (slPrice >= tradePrice) {
        slPrice = Number((tradePrice - Math.max(riskDist, tradePrice * 0.015)).toFixed(decimals));
      }
    } else {
      if (tpPrice >= tradePrice) {
        tpPrice = Number(Math.max(0, tradePrice - Math.max(riskDist * (config.riskRewardRatio || 2.0), tradePrice * 0.03)).toFixed(decimals));
      }
      if (slPrice <= tradePrice) {
        slPrice = Number((tradePrice + Math.max(riskDist, tradePrice * 0.015)).toFixed(decimals));
      }
    }

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
      slPrice,
      tp1Price: tpPrice,
      tp2Price: tpPrice,
      tp3Price: tpPrice,
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

    // Add log with bot attribution: Comprehensive Trade Executed Event
    addLog({
      groupName,
      botCode: botDisplayName,
      botName: botDisplayName,
      symbol,
      type: 'TRADE_EXECUTED',
      side: newPosition.side,
      price: tradePrice,
      sizeFraction: `Slot ${activeCount + 1} (10% Equity • ${lev}x • ${contractVol} Contracts)`,
      message: `[TRADE EXECUTED] ${botDisplayName} placed ${newPosition.side} on ${symbol} | Contracts: ${contractVol} | Entry: $${tradePrice.toFixed(4)} | Leverage: ${lev}x | SL: $${slPrice.toFixed(4)} (EMA 200) | TP: $${tpPrice.toFixed(4)} (1:2 Target • 100% Exit) | Conviction: ${confidenceScore}%.`,
    });

    // Send Telegram alert with same-candle timing metadata
    sendTelegramAlert('ENTRY', newPosition, tradePrice, undefined, analysis.candleTiming);

    // Execute real order on MEXC
    if (apiKey && secretKey) {
      executeMexcOrder(symbol, side, lev, contractVol, slPrice, tpPrice).then((result) => {
        if (!result.success) {
          console.warn('[MEXC] Order rejected:', result.message);
          
          // Check if contract is not activated
          if (result.message && result.message.includes('Contract not activated')) {
            setNonActivatedContracts((prev) => {
              const updated = new Set(prev);
              updated.add(symbol);
              return updated;
            });
            addLog({
              groupName,
              symbol,
              type: 'ELIMINATED_OPPORTUNITY',
              side: 'INFO',
              price: tradePrice,
              message: `[CONTRACT NOT ACTIVATED] ${symbol} is not activated on your MEXC futures account. Skipped from execution.`,
            });
          }
          
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
            type: 'ELIMINATED_OPPORTUNITY',
            side: 'INFO',
            price: tradePrice,
            message: `[AUTO-REVERT] ${botDisplayName} position on ${symbol} reverted — MEXC order failed: ${result.message}. Slot freed.`,
          });
        } else {
          // Order succeeded — store exchange orderId and place native TP/SL trigger orders on MEXC
          if (result?.orderId) {
            setPositions((prev) => {
              const updated = prev.map((p) => (p.id === newPosition.id ? { ...p, orderId: String(result.orderId) } : p));
              positionsRef.current = updated;
              return updated;
            });
          }
          const positionType = side === 'BUY' ? 1 : 2; // 1=Long, 2=Short
          setTimeout(() => {
            console.log('[MEXC] Placing exchange TP/SL plan orders for', symbol, 'positionType:', positionType, 'TP:', tpPrice, 'SL:', slPrice, 'contractVol:', contractVol);
            executeMexcTpsl(symbol, positionType, tpPrice, slPrice, contractVol, 1, contractVol).then((tpslResult) => {
              if (tpslResult.success) {
                console.log('[MEXC] Exchange TP/SL plan orders active on MEXC for', symbol);
                addLog({
                  groupName,
                  symbol,
                  type: 'TPSL',
                  side: newPosition.side,
                  price: tradePrice,
                  message: `[EXCHANGE TP/SL ACTIVE] Native orders placed on MEXC platform: SL=$${formatPrice(slPrice)} (EMA 200), TP=$${formatPrice(tpPrice)} (1:2 Target • ${contractVol} contracts). Visible in MEXC Trigger Orders tab.`,
                });
              } else {
                console.warn('[MEXC] Exchange TP/SL setup warning:', tpslResult.message);
                addLog({
                  groupName,
                  symbol,
                  type: 'TPSL',
                  side: newPosition.side,
                  price: tradePrice,
                  message: `[NOTICE] Exchange TP/SL: ${tpslResult.message}. Real-time WebSocket monitoring active.`,
                });
              }
            });
          }, 2000); // 2s wait for position fill
        }
      });
    }

    setPositions(positionsRef.current);
    return true;
  }, [bots, equity, availableBalance, config, addLog, sendTelegramAlert, apiKey, secretKey]);

  // Auto-execute confirmed scanner signals while AUTO TRADING is enabled
  const MAX_SIGNAL_RETRIES = 2;
  const SIGNAL_EXPIRY_MS = 60 * 1000; // Strictly 60 seconds (1 minute max freshness - no old signals)
  const RETRY_COOLDOWN_MS = 15000; // 15 seconds cooldown between retry checks

  // Track contracts that are not activated on MEXC (persisted in localStorage)
  const [nonActivatedContracts, setNonActivatedContracts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('monorid_non_activated_contracts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('monorid_non_activated_contracts', JSON.stringify(Array.from(nonActivatedContracts)));
    } catch (err) {
      console.warn('Failed to save nonActivatedContracts to localStorage:', err);
    }
  }, [nonActivatedContracts]);

  useEffect(() => {
    if (!isAutoTrading || !apiKey || !secretKey) {
      console.log('[Execution] Blocked: isAutoTrading=', isAutoTrading, 'apiKey=', !!apiKey, 'secretKey=', !!secretKey);
      return;
    }

    const executeSignals = async () => {
      const now = Date.now();
      const toRemove = new Set<string>();
      const toExecute: ActiveSignalItem[] = [];

      console.log('[Execution] Checking', activeSignals.length, 'active signals, equity=', equity, 'availableBalance=', availableBalance);

      const currentAvail = availableBalance !== null ? availableBalance : equity;
      if (currentAvail < MIN_AVAILABLE_BALANCE_USDT || equity < MIN_AVAILABLE_BALANCE_USDT) {
        if (activeSignals.length > 0) {
          const sig = activeSignals[0];
          const logKey = `low-balance-${Math.floor(Date.now() / 60000)}`;
          if (!loggedEliminatedRef.current.has(logKey)) {
            loggedEliminatedRef.current.add(logKey);
            addLog({
              groupName: sig.groupName || 'Risk Engine',
              symbol: sig.symbol,
              type: 'ELIMINATED_OPPORTUNITY',
              side: 'INFO',
              price: sig.price || 0,
              message: `Trade skipped: Available balance ($${currentAvail.toFixed(2)}) is below minimum safety threshold ($${MIN_AVAILABLE_BALANCE_USDT.toFixed(2)}).`,
            });
          }
        }
        console.log(`[Execution] Blocked: Available balance ($${currentAvail.toFixed(2)}) < $${MIN_AVAILABLE_BALANCE_USDT.toFixed(2)}`);
        return;
      }

    for (const sig of activeSignals) {
      if (sig.status !== 'ACTIVE') {
        toRemove.add(sig.symbol);
        continue;
      }
      
      // Skip non-activated contracts
      if (nonActivatedContracts.has(sig.symbol)) {
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'ELIMINATED_OPPORTUNITY',
          side: 'INFO',
          price: sig.price,
          message: `Eliminated Opportunity: Signal skipped on ${sig.symbol} — Contract not activated on MEXC futures account.`,
        });
        continue;
      }

      // Skip coins in 30-Minute Post-Loss Cooldown
      const cooldownUntil = lossCooldownsRef.current.get(sig.symbol);
      if (cooldownUntil && cooldownUntil > now) {
        const remainingMin = Math.ceil((cooldownUntil - now) / 60000);
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'ELIMINATED_OPPORTUNITY',
          side: 'INFO',
          price: sig.price,
          message: `Eliminated Opportunity: Signal skipped on ${sig.symbol} — Asset in post-loss cooldown (${remainingMin}m remaining) after Stop Loss.`,
        });
        continue;
      }
      
      if (sig.retryCount >= MAX_SIGNAL_RETRIES) {
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'ELIMINATED_OPPORTUNITY',
          side: 'INFO',
          price: sig.price,
          message: `Eliminated Opportunity: Trade on ${sig.symbol} skipped — Maximum execution retries (${MAX_SIGNAL_RETRIES}) reached.`,
        });
        continue;
      }
      // Strictly enforce: trade executed ONLY if signal is fresh (< 60s old)
      const signalAge = now - sig.timestamp;
      if (signalAge > SIGNAL_EXPIRY_MS) {
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'ELIMINATED_OPPORTUNITY',
          side: 'INFO',
          price: sig.price,
          message: `Eliminated Opportunity: Stale signal skipped on ${sig.symbol} (${Math.round(signalAge / 1000)}s old > 60s limit). Execution policy: fresh signals (< 1 min) only.`,
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

      // Strictly enforce: trade executed ONLY if confidence score is >= minConfidence (default 80%)
      const minConf = config.minConfidence || 80;
      const confidence = sig.confidence || analysis.confidence || 0;
      if (confidence < minConf) {
        toRemove.add(sig.symbol);
        addLog({
          groupName: sig.groupName,
          symbol: sig.symbol,
          type: 'ELIMINATED_OPPORTUNITY',
          side: 'INFO',
          price: sig.price,
          message: `Eliminated Opportunity: Trade skipped on ${sig.symbol} — Confidence score ${confidence}% < ${minConf}% threshold. High-conviction execution policy enforced.`,
        });
        continue;
      }

      toExecute.push(sig);
    }

    if (toRemove.size > 0) {
      setActiveSignals((prev) => prev.filter((s) => !toRemove.has(s.symbol)));
    }

    for (const sig of toExecute) {
      // Re-verify freshness immediately before trade dispatch
      if (Date.now() - sig.timestamp > SIGNAL_EXPIRY_MS) {
        executingSymbolsRef.current.delete(sig.symbol);
        setActiveSignals((prev) => prev.filter((s) => s.symbol !== sig.symbol));
        continue;
      }

      executingSymbolsRef.current.add(sig.symbol);
      lastAttemptRef.current.set(sig.symbol, now);
      const ticker = tickers.find((t) => t.symbol === sig.symbol);
      const analysis = sig.analysis || scanResults[sig.symbol];
      if (!analysis || (analysis.action !== 'BUY' && analysis.action !== 'SELL')) {
        executingSymbolsRef.current.delete(sig.symbol);
        continue;
      }

      // Instant same-candle trade execution (minimal micro-yield to ensure UI responsiveness)
      await new Promise(resolve => setTimeout(resolve, 50));

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
    };

    executeSignals();
  }, [activeSignals, isAutoTrading, scanResults, tickers, autoExecuteConfirmedTrade, apiKey, secretKey, nonActivatedContracts, addLog, availableBalance, equity]);

  // 4. Periodic re-sync: reconcile local positions with real MEXC exchange state
  useEffect(() => {
    if (!apiKey || !secretKey) return;

    const syncFromExchange = async () => {
      try {
        const [posRes, histRes] = await Promise.all([
          fetch('/api/mexc/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'positions', apiKey, secretKey }),
          }),
          fetch('/api/mexc/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'history_orders', page_size: 50, apiKey, secretKey }),
          }),
        ]);

        const posPayload = await posRes.json().catch(() => ({}));
        const histPayload = await histRes.json().catch(() => ({}));

        // Defensive check: if positions endpoint failed or returned error, abort sync to prevent wiping active positions
        if (!posPayload || posPayload.success === false) {
          console.warn('[Sync] Position sync paused — MEXC API returned non-success:', posPayload?.message);
          return;
        }

        const raw = Array.isArray(posPayload?.data) ? posPayload.data : [];
        const historyOrders = Array.isArray(histPayload?.data) ? histPayload.data : [];

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
          // 1. Separate existing closed positions from local state
          const existingClosed = prev.filter((p) => p.status === 'CLOSED');

          // 2. Open positions that are still active on MEXC
          const kept = prev.filter((p) => p.status === 'OPEN' && exchangeSymbols.has(p.symbol));
          const keptSymbols = new Set(kept.map((p) => p.symbol));

          // 3. Filter real completed close orders from MEXC API (must be completed filled close orders)
          const validCloseOrders = historyOrders.filter((order: any) => {
            const hasDealVol = Number(order.dealVol) > 0;
            const isCompleted = order.state === 3;
            const isCloseSide = order.side === 2 || order.side === 4;
            return isCompleted && hasDealVol && (isCloseSide || (order.profit !== 0 && order.profit !== undefined));
          });

          // Open positions that are no longer in MEXC open list: they closed on exchange!
          // If a matching close order exists in validCloseOrders, the order mapping below will handle it with full attribution.
          // Otherwise, record as fallback closed position only if verified.
          const fallbackClosed: MexcPosition[] = [];
          for (const p of prev) {
            if (p.status === 'OPEN' && !keptSymbols.has(p.symbol)) {
              // If the position was created recently (<45s), do not assume it has vanished/closed
              if (p.createdAt && Date.now() - p.createdAt < 45000) {
                kept.push(p);
                continue;
              }

              // Only match close orders that occurred AFTER the position was opened
              const hasMatchingOrder = validCloseOrders.some((o: any) =>
                (p.orderId && String(o.orderId) === String(p.orderId)) ||
                (p.positionId && String(o.positionId) === String(p.positionId)) ||
                (o.symbol === p.symbol && o.createTime && p.createdAt && o.createTime >= p.createdAt - 5000)
              );

              if (!hasMatchingOrder) {
                // If there is no matching completed close order on MEXC:
                // Check if market price actually penetrated the strategy Stop Loss or Take Profit
                const isLong = p.side === 'LONG';
                const curPrice = p.currentPrice || p.entryPrice;
                const reachedSl = isLong
                  ? (p.slPrice < p.entryPrice && p.slPrice > 0 && curPrice <= p.slPrice && curPrice < p.entryPrice)
                  : (p.slPrice > p.entryPrice && curPrice >= p.slPrice && curPrice > p.entryPrice);
                const reachedTp = isLong
                  ? (p.tp1Price > p.entryPrice && curPrice >= p.tp1Price && curPrice > p.entryPrice)
                  : (p.tp1Price < p.entryPrice && p.tp1Price > 0 && curPrice <= p.tp1Price && curPrice < p.entryPrice);

                // If neither SL nor TP was reached by market price, and there is no close order on MEXC:
                // This position was never filled or was cancelled/rejected on MEXC!
                // Discard/revert it completely to prevent phantom closed trades and false SL penalties.
                if (!reachedSl && !reachedTp) {
                  console.log(`[Sync] Discarding unfilled/cancelled position on ${p.symbol} (no exchange fill, TP/SL never reached)`);
                  executeCancelPendingOrders(p.symbol);
                  if (p.botId) {
                    setBots((prevBots) =>
                      prevBots.map((b) => (b.id === p.botId ? { ...b, status: 'ACTIVE', currentSymbol: undefined } : b))
                    );
                  }
                  continue;
                }

                const closeReason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL' = reachedTp ? 'TP1' : 'SL';
                const estFee = Number(((p.equityUsed * p.leverage) * 0.0008).toFixed(4));
                const finalPnl = p.realizedPnl || p.unrealizedPnl || 0;

                // Ensure all pending/plan orders on exchange are cancelled upon closing
                executeCancelPendingOrders(p.symbol);

                fallbackClosed.push({
                  ...p,
                  status: 'CLOSED' as const,
                  closeReason,
                  closedAt: Date.now(),
                  exitPrice: curPrice,
                  realizedPnl: finalPnl,
                  fee: p.fee || estFee,
                  fundingFee: p.fundingFee || 0,
                  netRealizedPnl: Number((finalPnl - (p.fee || estFee) + (p.fundingFee || 0)).toFixed(4)),
                });

                if (closeReason === 'SL') {
                  triggerLossCooldown(p.symbol, 'Exchange Stop Loss');
                }
              }
            }
          }

          // 4. Map real completed close orders from MEXC API
          const exchangeClosed: MexcPosition[] = [];
          for (const order of validCloseOrders) {
            const feeInfo = extractOrderFeeAndFunding(order);
            const side: 'LONG' | 'SHORT' = order.side === 4 ? 'LONG' : order.side === 2 ? 'SHORT' : (feeInfo.realizedPnl >= 0 ? 'LONG' : 'SHORT');
            const entry = Number(order.openAvgPrice) || 0;
            const exit = Number(order.dealAvgPrice) || entry;
            const pnl = feeInfo.realizedPnl;
            const pnlRate = Number(order.pnlRate) || 0;

            // Look for matching local position created around or before order completion
            const localMatch = prev.find((p) =>
              (p.orderId && String(p.orderId) === String(order.orderId)) ||
              (p.positionId && String(p.positionId) === String(order.positionId)) ||
              (p.symbol === order.symbol && Math.abs((p.closedAt || p.createdAt || 0) - (order.updateTime || order.createTime || 0)) <= 600000) ||
              (p.symbol === order.symbol && p.status === 'OPEN' && order.createTime && p.createdAt && order.createTime >= p.createdAt - 5000)
            );

            const matchedTicker = tickersRef.current.find((t) => t.symbol === order.symbol);
            const defaultGroup = matchedTicker?.groupName || 'Apex Cyber-Volatiles';
            const defaultBot = OFFICIAL_BOT_UNITS.find((b) => b.assignedGroup === defaultGroup) || OFFICIAL_BOT_UNITS[0];

            const botId = localMatch?.botId && localMatch.groupName !== 'Resynced (Exchange)' ? localMatch.botId : defaultBot.id;
            const botCode = localMatch?.botCode && localMatch.groupName !== 'Resynced (Exchange)' ? localMatch.botCode : defaultBot.code;
            const botName = localMatch?.botName && localMatch.groupName !== 'Resynced (Exchange)' ? localMatch.botName : defaultBot.name;
            const groupName = localMatch?.groupName && localMatch.groupName !== 'Resynced (Exchange)' ? localMatch.groupName : defaultGroup;

            const resolvedEntry = entry || localMatch?.entryPrice || Number(order.dealAvgPrice) || 0;
            const targets = reconstructStrategyTargets(resolvedEntry, side);
            const slPrice = localMatch?.slPrice && localMatch.slPrice > 0 ? localMatch.slPrice : targets.slPrice;
            const tp1Price = localMatch?.tp1Price && localMatch.tp1Price > 0 ? localMatch.tp1Price : targets.tp1Price;
            const equityUsed = localMatch?.equityUsed || Number(order.orderMargin) || 10;
            const leverage = localMatch?.leverage || Number(order.leverage) || 7;
            const orderId = String(order.orderId);
            const positionId = order.positionId ? Number(order.positionId) : undefined;

            const isLong = side === 'LONG';
            const slTol = slPrice > 0 ? slPrice * 0.0015 : 0;
            const tpTol = tp1Price > 0 ? tp1Price * 0.0015 : 0;
            const reachedSl = isLong
              ? (slPrice < resolvedEntry && slPrice > 0 && exit <= slPrice + slTol)
              : (slPrice > resolvedEntry && exit >= slPrice - slTol);
            const reachedTp = isLong
              ? (tp1Price > resolvedEntry && exit >= tp1Price - tpTol)
              : (tp1Price < resolvedEntry && tp1Price > 0 && exit <= tp1Price + tpTol);

            const extOid = String(order.externalOid || '');
            const isSlOrder = extOid.includes('STOP_LOSS') || (extOid.includes('planorder') && pnl < 0);
            const isTpOrder = extOid.includes('TAKE_PROFIT') || (extOid.includes('planorder') && pnl > 0);

            let closeReason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL';
            let hitTp = false;
            let hitSl = false;

            if (localMatch?.closeReason && localMatch.closeReason !== 'MANUAL') {
              closeReason = localMatch.closeReason;
              hitTp = localMatch.closeReason.startsWith('TP');
              hitSl = localMatch.closeReason === 'SL';
            } else if (isSlOrder || (reachedSl && pnl < -0.0001)) {
              closeReason = 'SL';
              hitSl = true;
            } else if (isTpOrder || (reachedTp && pnl > 0.0001)) {
              closeReason = 'TP1';
              hitTp = true;
            } else if (pnl < -0.0001) {
              closeReason = 'SL';
              hitSl = true;
            } else if (pnl > 0.0001) {
              closeReason = 'TP1';
              hitTp = true;
            } else {
              closeReason = 'MANUAL';
            }

            // Always cancel all remaining plan/stop/trigger orders for this symbol upon close confirmation
            executeCancelPendingOrders(order.symbol);

            // Only trigger cooldown if trade was an actual verified Stop Loss hit
            if (hitSl && (reachedSl || isSlOrder) && order.createTime && (Date.now() - order.createTime < 30 * 60 * 1000)) {
              triggerLossCooldown(order.symbol, 'Recent Exchange Loss');
            }

            exchangeClosed.push({
              id: `mexc-${order.orderId}`,
              orderId,
              positionId,
              externalOid: extOid || localMatch?.externalOid,
              symbol: order.symbol,
              groupName,
              botId,
              botCode,
              botName,
              side,
              entryPrice: entry || localMatch?.entryPrice || 0,
              currentPrice: exit,
              exitPrice: exit,
              leverage,
              initialSize: equityUsed,
              currentSize: 0,
              equityUsed,
              contractVol: Number(order.dealVol) || Number(order.vol) || localMatch?.contractVol || 1,
              closedVol: Number(order.dealVol) || Number(order.vol) || localMatch?.contractVol || 1,
              slPrice,
              tp1Price,
              tp2Price: localMatch?.tp2Price || tp1Price,
              tp3Price: localMatch?.tp3Price || tp1Price,
              tp1Hit: hitTp,
              tp2Hit: hitTp,
              tp3Hit: hitTp,
              slHit: hitSl,
              unrealizedPnl: 0,
              unrealizedPnlPct: 0,
              realizedPnl: pnl,
              realizedPnlPct: pnlRate ? pnlRate * 100 : (equityUsed > 0 ? (pnl / equityUsed) * 100 : 0),
              fee: feeInfo.fee,
              fundingFee: feeInfo.fundingFee,
              netRealizedPnl: feeInfo.netPnl,
              status: 'CLOSED' as const,
              createdAt: Number(order.createTime) || localMatch?.createdAt || Date.now(),
              closedAt: Number(order.updateTime) || Number(order.createTime) || Date.now(),
              closeReason,
            });
          }

          // Merge all closed positions and strictly deduplicate
          const rawAllClosed = [...existingClosed, ...fallbackClosed, ...exchangeClosed];
          const deduplicatedClosed = deduplicateClosedPositions(rawAllClosed);

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

            const targets = reconstructStrategyTargets(entry, side);

            seeded.push({
              id: `sync-${p.symbol}-${Date.now()}`,
              positionId: p.positionId,
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
              slPrice: targets.slPrice,
              tp1Price: targets.tp1Price,
              tp2Price: targets.tp2Price,
              tp3Price: targets.tp3Price,
              tp1Hit: false, tp2Hit: false, tp3Hit: false, slHit: false,
              unrealizedPnl: apiPnl,
              unrealizedPnlPct: pnlPct,
              realizedPnl: 0,
              fee: 0,
              fundingFee: 0,
              netRealizedPnl: 0,
              status: 'OPEN',
              createdAt: Date.now(),
            });
            keptSymbols.add(p.symbol);
          }

          const next = [...kept, ...seeded, ...deduplicatedClosed];
          positionsRef.current = next;

          if (deduplicatedClosed.length > 0) {
            persistTradesToServer(deduplicatedClosed, 'sync');
          }

          if (fallbackClosed.length > 0) {
            for (const pos of fallbackClosed) {
              const isTp = pos.closeReason === 'TP1' && (pos.realizedPnl !== undefined && pos.realizedPnl > 0.0001);
              const exitPrice = pos.exitPrice || pos.currentPrice || pos.entryPrice;
              if (isTp) {
                addLog({
                  groupName: pos.groupName,
                  symbol: pos.symbol,
                  type: 'TP_HIT',
                  side: pos.side,
                  price: exitPrice,
                  sizeFraction: '100% Full Exit (1:2 Target)',
                  pnl: pos.realizedPnl,
                  fee: pos.fee,
                  fundingFee: pos.fundingFee,
                  netPnl: pos.netRealizedPnl,
                  message: `Take Profit 1:2 Hit: ${pos.symbol} (${pos.side}) closed on MEXC exchange at $${formatPrice(exitPrice)}. Realized Profit: +$${(pos.realizedPnl || 0).toFixed(2)}${pos.fee ? ` (Net: +$${(pos.netRealizedPnl || 0).toFixed(2)}, Fee: -$${pos.fee.toFixed(4)})` : ''} (100% position exit).`,
                });
              } else {
                addLog({
                  groupName: pos.groupName,
                  symbol: pos.symbol,
                  type: 'SL_HIT',
                  side: pos.side,
                  price: exitPrice,
                  pnl: pos.realizedPnl,
                  fee: pos.fee,
                  fundingFee: pos.fundingFee,
                  netPnl: pos.netRealizedPnl,
                  message: `Stop Loss Hit: ${pos.symbol} (${pos.side}) executed on MEXC exchange at $${formatPrice(exitPrice)}. Realized Loss: -$${Math.abs(pos.realizedPnl || 0).toFixed(2)}${pos.fee ? ` (Net: -$${Math.abs(pos.netRealizedPnl || 0).toFixed(2)}, Fee: -$${pos.fee.toFixed(4)})` : ''}. Post-loss cooldown activated on ${pos.symbol}.`,
                });
              }
            }
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

  // 5. Background Automated 24/7 Scanning Loop - rapid 12s cycle for maximum opportunity detection
  useEffect(() => {
    const scanInterval = setInterval(() => {
      runScanner();
    }, 12000); // 12 seconds: ultra-fast cycle catching 1M candle signals within seconds of formation

    return () => {
      clearInterval(scanInterval);
    };
  }, [runScanner]);

  // 6. Periodic Ticker Refresh Loop - keeps 24h market prices, volumes, and rankings fresh across all tabs
  useEffect(() => {
    const tickerInterval = setInterval(() => {
      loadTickers();
    }, 20000);

    return () => {
      clearInterval(tickerInterval);
    };
  }, [loadTickers]);

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
            type: 'TRADE_EXECUTED',
            side: p.side,
            price: p.currentPrice,
            pnl: p.unrealizedPnl,
            message: `Manually closed ${p.symbol} (${p.side}) position. Final P&L: $${p.unrealizedPnl.toFixed(2)}.`,
          });
          // Execute real close on MEXC (remaining contracts) and cancel all pending orders
          if (apiKey && secretKey) {
            const remaining = p.contractVol - p.closedVol;
            if (remaining >= 1) {
              executeMexcClose(p.symbol, p.side === 'LONG' ? 1 : 2, remaining);
            }
            executeCancelPendingOrders(p.symbol);
          }
          const totalRealizedPnl = (p.realizedPnl || 0) + p.unrealizedPnl;
          const realizedPnlPct = p.equityUsed > 0 ? (totalRealizedPnl / p.equityUsed) * 100 : 0;
          const estFee = p.fee || Number(((p.equityUsed * p.leverage) * 0.0008).toFixed(4));
          const fundingFee = p.fundingFee || 0;
          const netRealizedPnl = Number((totalRealizedPnl - estFee + fundingFee).toFixed(4));
          const closedPos = { 
            ...p, 
            status: 'CLOSED' as const, 
            closeReason: 'MANUAL' as const,
            exitPrice: p.currentPrice || p.entryPrice,
            closedAt: Date.now(),
            realizedPnl: totalRealizedPnl,
            realizedPnlPct,
            fee: estFee,
            fundingFee,
            netRealizedPnl,
          };
          persistTradesToServer(closedPos, 'append');
          return closedPos;
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
          executeCancelPendingOrders(p.symbol);
        });
    }
    const flattened: MexcPosition[] = [];
    setPositions((prev) =>
      prev.map((p) => {
        if (p.status === 'OPEN') {
          const totalRealizedPnl = (p.realizedPnl || 0) + p.unrealizedPnl;
          const realizedPnlPct = p.equityUsed > 0 ? (totalRealizedPnl / p.equityUsed) * 100 : 0;
          const estFee = p.fee || Number(((p.equityUsed * p.leverage) * 0.0008).toFixed(4));
          const fundingFee = p.fundingFee || 0;
          const netRealizedPnl = Number((totalRealizedPnl - estFee + fundingFee).toFixed(4));
          const closed = {
            ...p,
            status: 'CLOSED' as const,
            closeReason: 'MANUAL' as const,
            exitPrice: p.currentPrice || p.entryPrice,
            closedAt: Date.now(),
            realizedPnl: totalRealizedPnl,
            realizedPnlPct,
            fee: estFee,
            fundingFee,
            netRealizedPnl,
          };
          flattened.push(closed);
          return closed;
        }
        return p;
      })
    );
    if (flattened.length > 0) {
      persistTradesToServer(flattened, 'append');
    }
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

  // Calculate live portfolio metrics from real account balance
  const openPositionsCount = positions.filter((p) => p.status === 'OPEN').length;
  const marginUsed = positions
    .filter((p) => p.status === 'OPEN')
    .reduce((sum, p) => sum + p.equityUsed, 0);

  const closedPositions = positions.filter((p) => p.status === 'CLOSED');
  const totalTrades = closedPositions.length;
  const getNetPnl = (p: MexcPosition) => p.netRealizedPnl !== undefined ? p.netRealizedPnl : ((p.realizedPnl || 0) - (p.fee || 0) + (p.fundingFee || 0));
  const winningTrades = closedPositions.filter((p) => getNetPnl(p) > 0);
  const losingTrades = closedPositions.filter((p) => getNetPnl(p) < 0);
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
  const grossProfit = winningTrades.reduce((sum, p) => sum + getNetPnl(p), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, p) => sum + getNetPnl(p), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + getNetPnl(p), 0);

  // P&L based on actual account balance vs starting balance, fallback to total realized P&L
  const computedTodayPnl = (startingBalance !== null && startingBalance > 0 && Math.abs(equity - startingBalance) > 0.001)
    ? equity - startingBalance
    : totalRealizedPnl;
  const computedTodayPnlPct = startingBalance !== null && startingBalance > 0 ? (computedTodayPnl / startingBalance) * 100 : 0;

  const maxDrawdownPct = startingBalance !== null && startingBalance > 0 ? (Math.max(0, grossLoss) / startingBalance) * 100 : 0;
  const portfolioRiskPct = equity > 0 ? (marginUsed / equity) * 100 : 0;
  const totalBotPnl = computedTodayPnl;

  // Maintain real-time rolling P&L history for live chart
  useEffect(() => {
    setPnlHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last !== undefined && Math.abs(last - computedTodayPnl) < 0.001) {
        return prev;
      }
      const updated = [...prev, computedTodayPnl].slice(-40);
      if (mounted) {
        try {
          localStorage.setItem('monorid_pnl_history', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, [computedTodayPnl]);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans" suppressHydrationWarning>
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
        availableBalance={availableBalance}
        todayPnl={Number(computedTodayPnl.toFixed(2))}
        todayPnlPct={Number(computedTodayPnlPct.toFixed(2))}
        openPositionsCount={openPositionsCount}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onEmergencyFlatten={handleEmergencyFlatten}
        serverIp={serverIp}
        onOpenGridBreakdown={() => setIsLogoMotionModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full space-y-5">
        {/* Diagnostic Status Banner - Shows why trades aren't executing */}
        {activeTab === 'dashboard' && (
          <div 
            suppressHydrationWarning
            className={`p-3 rounded-lg border ${!apiKey || !secretKey || equity <= 0 || (availableBalance !== null ? availableBalance : equity) < MIN_AVAILABLE_BALANCE_USDT || equity < MIN_AVAILABLE_BALANCE_USDT ? 'border-rose-500/50 bg-rose-950/20' : 'border-emerald-500/50 bg-emerald-950/20'} text-xs font-mono`}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${mounted && apiKey && secretKey ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className="text-slate-400">API:</span>
                <span className={mounted && apiKey && secretKey ? 'text-emerald-400' : 'text-rose-400'}>
                  {mounted && apiKey && secretKey ? 'Connected' : 'Not Configured'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${mounted && equity > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className="text-slate-400">Balance:</span>
                <span className={mounted && equity > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  ${mounted ? equity.toFixed(2) : '0.00'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${mounted && (availableBalance !== null ? availableBalance : equity) >= MIN_AVAILABLE_BALANCE_USDT && equity >= MIN_AVAILABLE_BALANCE_USDT ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className="text-slate-400">Available:</span>
                <span className={mounted && (availableBalance !== null ? availableBalance : equity) >= MIN_AVAILABLE_BALANCE_USDT && equity >= MIN_AVAILABLE_BALANCE_USDT ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  ${mounted ? (availableBalance !== null ? availableBalance : equity).toFixed(2) : '0.00'}
                </span>
              </span>
              {mounted && ((availableBalance !== null ? availableBalance : equity) < MIN_AVAILABLE_BALANCE_USDT || equity < MIN_AVAILABLE_BALANCE_USDT) && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[11px] font-bold animate-pulse">
                  ⚠️ Balance &lt; $0.70 (Trades Blocked)
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isAutoTrading ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className="text-slate-400">Auto:</span>
                <span className={isAutoTrading ? 'text-emerald-400' : 'text-amber-400'}>
                  {isAutoTrading ? 'ON' : 'OFF'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${mounted && activeSignals.length > 0 ? 'bg-cyan-400' : 'bg-slate-600'}`}></span>
                <span className="text-slate-400">Signals:</span>
                <span className={mounted && activeSignals.length > 0 ? 'text-cyan-400' : 'text-slate-500'}>
                  {mounted ? activeSignals.length : 0}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-slate-400">Confidence Rule:</span>
                <span className="text-emerald-300 font-bold">
                  &gt; 75% Only
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${mounted && lossCooldowns.size > 0 ? 'bg-amber-400' : 'bg-slate-600'}`}></span>
                <span className="text-slate-400">Loss Cooldowns:</span>
                <span className={mounted && lossCooldowns.size > 0 ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                  {mounted ? Array.from(lossCooldowns.values()).filter(t => t > Date.now()).length : 0} Active
                </span>
              </span>
              {mounted && (!apiKey || !secretKey) && (
                <span className="text-rose-400 font-bold ml-auto animate-pulse">
                  ⚠ Click Settings to configure MEXC API keys
                </span>
              )}
              {mounted && apiKey && secretKey && equity <= 0 && (
                <span className="text-rose-400 font-bold ml-auto animate-pulse">
                  ⚠ Fund your MEXC Futures account to enable trading
                </span>
              )}
              {mounted && apiKey && secretKey && equity > 0 && activeSignals.length === 0 && (
                <span className="text-cyan-400 ml-auto">
                  ✓ System ready - Scanner searching for signals every 1 min
                </span>
              )}
            </div>
          </div>
        )}

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
                  scanSpeedMs={lastScanDurationMs}
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
                    availableBalance={availableBalance}
                    marginUsed={marginUsed}
                    portfolioRiskPct={Number(portfolioRiskPct.toFixed(2))}
                    maxDrawdownPct={Number(maxDrawdownPct.toFixed(2))}
                    activePositionsCount={openPositionsCount}
                  />
                </div>
                <div className="flex-1">
                  <PerformanceSummaryCard
                    todayPnl={Number(computedTodayPnl.toFixed(2))}
                    todayPnlPct={Number(computedTodayPnlPct.toFixed(2))}
                    winRate={Number(winRate.toFixed(1))}
                    profitFactor={Number(profitFactor.toFixed(2))}
                    totalTrades={totalTrades}
                    closedPositions={closedPositions}
                    pnlHistory={pnlHistory}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARKET SCANNER (90 Contracts in 6 Groups of 15) */}
        {activeTab === 'scanner' && (
          <MarketScanner
            tickers={tickers}
            scanResults={scanResults}
            onViewChart={handleOpenChart}
            onRefreshScan={() => runScanner()}
            isScanningBatch={isScanningBatch}
            scanDurationMs={lastScanDurationMs}
            nonActivatedContracts={nonActivatedContracts}
            lossCooldowns={lossCooldowns}
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
            onClearClosedPositions={async () => {
              setPositions((prev) => {
                const openOnly = prev.filter((p) => p.status !== 'CLOSED');
                positionsRef.current = openOnly;
                return openOnly;
              });
              try {
                localStorage.setItem('monorid_positions', JSON.stringify(positionsRef.current.filter((p) => p.status !== 'CLOSED')));
                await fetch('/api/storage/trades', { method: 'DELETE' });
              } catch (err) {
                console.warn('[Storage] Failed to clear server trades:', err);
              }
            }}
          />
        )}

        {/* TAB 4: TRADE LOGS AUDIT */}
        {activeTab === 'logs' && (
          <TradeLogsView
            logs={logs}
            onClearLogs={async () => {
              setLogs([]);
              pendingLogsRef.current = [];
              try {
                localStorage.removeItem('monorid_logs');
                await fetch('/api/storage/logs', { method: 'DELETE' });
              } catch (err) {
                console.warn('[Storage] Failed to clear server logs:', err);
              }
            }}
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
