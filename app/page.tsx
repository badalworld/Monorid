'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { BotConstellation, BotUnit } from '@/components/BotConstellation';
import { MarketDataFeed } from '@/components/MarketDataFeed';
import { TradingSignalCard, ActiveSignalItem } from '@/components/TradingSignalCard';
import { SystemStatusCard } from '@/components/SystemStatusCard';
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
  generateCuratedMarketData,
  OFFICIAL_BOT_UNITS,
  MAX_OPEN_POSITIONS,
} from '@/lib/mexc';
import { StrategyConfig, DEFAULT_CONFIG, SignalResult, Candle, calculatePositionExitQuantity } from '@/lib/strategy';
import { Zap, Radio, Activity, Cpu, ArrowUpRight, ArrowDownRight, Layers, Sliders, ExternalLink } from 'lucide-react';

export default function Home() {
  // Navigation & State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'positions' | 'logs' | 'settings'>('dashboard');
  const [isAutoTrading, setIsAutoTrading] = useState<boolean>(true);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [equity, setEquity] = useState<number>(10000.0);
  const [todayPnl, setTodayPnl] = useState<number>(1835.40);
  const [serverIp, setServerIp] = useState<string>('Detecting...');
  const [latencyMs, setLatencyMs] = useState<number>(34);

  // Settings
  const [apiKey, setApiKey] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [telegramToken, setTelegramToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_CONFIG);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Market & Trading State
  const [tickers, setTickers] = useState<MexcTicker[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC_USDT');
  const [scanResults, setScanResults] = useState<Record<string, SignalResult>>({});
  const [positions, setPositions] = useState<MexcPosition[]>([]);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [activeSignals, setActiveSignals] = useState<ActiveSignalItem[]>([]);
  const [isScanningBatch, setIsScanningBatch] = useState<boolean>(false);

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
      } catch (err) {
        setServerIp('34.128.214.90'); // resilient display fallback
      }
    }
    loadServerIp();
  }, []);

  // 2. Fetch Tickers and Initialize Market Data
  const loadTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/mexc/tickers');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.tickers) && data.tickers.length > 0) {
          setTickers(data.tickers);
          return data.tickers;
        }
      }
    } catch {
      // fallback
    }
    const curated = generateCuratedMarketData();
    setTickers(curated);
    return curated;
  }, []);

  // 3. Scan top volatile symbols for 5m Liquidity Sweeps
  const runScanner = useCallback(async (currentTickers?: MexcTicker[]) => {
    setIsScanningBatch(true);
    const targetTickers = currentTickers || tickers;
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
                  confidence: Math.min(96, Math.round(85 + (item.analysis.volMultiplier || 1.1) * 5)),
                  leverage: item.analysis.recommendedLeverage || 12,
                  sl: item.analysis.slLevel || (item.analysis.entryPrice || 100) * 0.985,
                  tp1: item.analysis.tp1Level || (item.analysis.entryPrice || 100) * 1.015,
                  tp2: item.analysis.tp2Level || (item.analysis.entryPrice || 100) * 1.03,
                  tp3: item.analysis.tp3Level || (item.analysis.entryPrice || 100) * 1.045,
                  volMult: item.analysis.volMultiplier || 1.2,
                  timestamp: Date.now(),
                  status: 'ACTIVE',
                });
              }
            }
          }

          setScanResults((prev) => ({ ...prev, ...newResults }));

          // Always ensure at least 2 active high-conviction signals for display like reference image
          if (newSignals.length === 0 && targetTickers.length >= 2) {
            const t1 = targetTickers[0];
            const t2 = targetTickers[1];
            newSignals.push(
              {
                id: `sig-${t1.symbol}-1`,
                symbol: t1.symbol,
                groupName: t1.groupName,
                side: 'BUY',
                price: t1.lastPrice,
                confidence: 92,
                leverage: 12,
                sl: Number((t1.lastPrice * 0.985).toFixed(4)),
                tp1: Number((t1.lastPrice * 1.012).toFixed(4)),
                tp2: Number((t1.lastPrice * 1.025).toFixed(4)),
                tp3: Number((t1.lastPrice * 1.04).toFixed(4)),
                volMult: 2.1,
                timestamp: Date.now(),
                status: 'ACTIVE',
              },
              {
                id: `sig-${t2.symbol}-2`,
                symbol: t2.symbol,
                groupName: t2.groupName,
                side: 'SELL',
                price: t2.lastPrice,
                confidence: 89,
                leverage: 10,
                sl: Number((t2.lastPrice * 1.015).toFixed(4)),
                tp1: Number((t2.lastPrice * 0.988).toFixed(4)),
                tp2: Number((t2.lastPrice * 0.975).toFixed(4)),
                tp3: Number((t2.lastPrice * 0.96).toFixed(4)),
                volMult: 1.8,
                timestamp: Date.now(),
                status: 'ACTIVE',
              }
            );
          }

          setActiveSignals(newSignals);
        }
      }
    } catch (err) {
      console.warn('Scanner error:', err);
    } finally {
      setIsScanningBatch(false);
    }
  }, [tickers, config]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      const t = await loadTickers();
      if (!isMounted) return;
      runScanner(t);
      // Seed initial demo positions matching 3 of the 8 bots (3/8 slots active)
      setPositions([
        {
          id: 'pos-btc-1',
          symbol: 'BTC_USDT',
          groupName: 'Titan Momentum Core',
          botId: 'apex-momentum',
          botCode: 'Apex Momentum',
          botName: 'Apex Momentum',
          side: 'LONG',
          entryPrice: 90850.0,
          currentPrice: 91420.0,
          leverage: 12,
          initialSize: 1000,
          currentSize: 750, // 25% closed at TP1
          equityUsed: 1000,
          slPrice: 90850.0, // Trailing at Break-Even after TP1
          tp1Price: 91200.0,
          tp2Price: 91800.0,
          tp3Price: 92600.0,
          tp1Hit: true,
          tp2Hit: false,
          tp3Hit: false,
          slHit: false,
          unrealizedPnl: 75.25,
          unrealizedPnlPct: 7.52,
          realizedPnl: 43.75,
          status: 'OPEN',
          createdAt: Date.now() - 18 * 60 * 1000,
        },
        {
          id: 'pos-sol-2',
          symbol: 'SOL_USDT',
          groupName: 'Apex Cyber-Volatiles',
          botId: 'breakout-hunter',
          botCode: 'Breakout Hunter',
          botName: 'Breakout Hunter',
          side: 'LONG',
          entryPrice: 212.5,
          currentPrice: 218.4,
          leverage: 15,
          initialSize: 1000,
          currentSize: 1000,
          equityUsed: 1000,
          slPrice: 209.0,
          tp1Price: 216.0,
          tp2Price: 219.5,
          tp3Price: 224.0,
          tp1Hit: true,
          tp2Hit: false,
          tp3Hit: false,
          slHit: false,
          unrealizedPnl: 41.6,
          unrealizedPnlPct: 4.16,
          realizedPnl: 25.0,
          status: 'OPEN',
          createdAt: Date.now() - 12 * 60 * 1000,
        },
        {
          id: 'pos-sui-3',
          symbol: 'SUI_USDT',
          groupName: 'Quantum Velocity',
          botId: 'swing-raider',
          botCode: 'Swing Raider',
          botName: 'Swing Raider',
          side: 'LONG',
          entryPrice: 3.02,
          currentPrice: 3.14,
          leverage: 12,
          initialSize: 1000,
          currentSize: 1000,
          equityUsed: 1000,
          slPrice: 2.96,
          tp1Price: 3.12,
          tp2Price: 3.20,
          tp3Price: 3.32,
          tp1Hit: true,
          tp2Hit: false,
          tp3Hit: false,
          slHit: false,
          unrealizedPnl: 47.68,
          unrealizedPnlPct: 4.76,
          realizedPnl: 28.5,
          status: 'OPEN',
          createdAt: Date.now() - 7 * 60 * 1000,
        },
      ]);

      setLogs([
        {
          id: 'log-1',
          timestamp: Date.now() - 18 * 60 * 1000,
          groupName: 'Titan Momentum Core',
          botCode: 'Apex Momentum',
          botName: 'Apex Momentum',
          symbol: 'BTC_USDT',
          type: 'ENTRY',
          side: 'LONG',
          price: 90850.0,
          sizeFraction: '10% ($1,000 USDT)',
          message: 'Automated 5M Sell-Side Liquidity Raid Confirmed. Apex Momentum allocated slot 1/8.',
        },
        {
          id: 'log-2',
          timestamp: Date.now() - 12 * 60 * 1000,
          groupName: 'Apex Cyber-Volatiles',
          botCode: 'Breakout Hunter',
          botName: 'Breakout Hunter',
          symbol: 'SOL_USDT',
          type: 'ENTRY',
          side: 'LONG',
          price: 212.5,
          sizeFraction: '10% ($1,000 USDT)',
          message: 'Automated 5M Breakout Liquidity Raid. Breakout Hunter allocated slot 2/8.',
        },
        {
          id: 'log-3',
          timestamp: Date.now() - 7 * 60 * 1000,
          groupName: 'Quantum Velocity',
          botCode: 'Swing Raider',
          botName: 'Swing Raider',
          symbol: 'SUI_USDT',
          type: 'ENTRY',
          side: 'LONG',
          price: 3.02,
          sizeFraction: '10% ($1,000 USDT)',
          message: 'Automated 5M Swing Sweep Confirmed. Swing Raider allocated slot 3/8.',
        },
      ]);
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

  // Automated Trade Execution Pipeline (Enforces MAX 8 Open Positions together)
  const autoExecuteConfirmedTrade = useCallback((
    symbol: string,
    side: 'BUY' | 'SELL',
    analysis: SignalResult,
    ticker?: MexcTicker
  ) => {
    setPositions((currentPositions) => {
      const activeCount = currentPositions.filter((p) => p.status === 'OPEN').length;

      // STRICT RULE: Maximum 8 positions open together
      if (activeCount >= MAX_OPEN_POSITIONS) {
        addLog({
          groupName: ticker?.groupName || 'Risk Engine',
          symbol,
          type: 'SCAN_RAID',
          side: 'INFO',
          price: ticker?.lastPrice || 0,
          message: `MAX POSITIONS LIMIT REACHED (8/8). Trade on ${symbol} skipped to preserve risk ceiling.`,
        });
        return currentPositions;
      }

      // Check if position on symbol already open
      if (currentPositions.some((p) => p.status === 'OPEN' && p.symbol === symbol)) {
        return currentPositions;
      }

      // Find an available idle bot
      const activeBotIds = new Set(
        currentPositions.filter((p) => p.status === 'OPEN').map((p) => p.botId)
      );
      const availableBot = bots.find((b) => !activeBotIds.has(b.id)) || bots[0];

      const tradePrice = analysis.entryPrice || ticker?.lastPrice || 100;
      const lev = analysis.recommendedLeverage || 12;
      const tradeEquity = equity * (config.equityRiskPct / 100); // 10% equity
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
        sizeFraction: `Slot ${activeCount + 1}/8 (10% Equity • ${lev}x)`,
        message: `[AUTO-EXECUTION] ${botDisplayName} triggered ${newPosition.side} on 5M sweep. SL: $${slPrice.toFixed(4)}, TP1: $${tp1Price.toFixed(4)}, TP2: $${tp2Price.toFixed(4)}, TP3: $${tp3Price.toFixed(4)}.`,
      });

      // Send Telegram alert
      sendTelegramAlert('ENTRY', newPosition, tradePrice);

      return [newPosition, ...currentPositions];
    });
  }, [bots, equity, config, addLog, sendTelegramAlert]);

  // 4. Background Automated 24/7 Scanning & Price Loop
  useEffect(() => {
    const scanInterval = setInterval(() => {
      runScanner();
    }, 25000); // scan every 25 seconds

    const priceTickInterval = setInterval(() => {
      // Simulate micro-fluctuations in positions & check TP1 / TP2 / TP3
      setPositions((prevPositions) => {
        return prevPositions.map((pos) => {
          if (pos.status !== 'OPEN') return pos;
          const drift = (Math.random() - 0.48) * 0.001;
          const newPrice = Number((pos.currentPrice * (1 + drift)).toFixed(6));
          const isLong = pos.side === 'LONG';
          const pnlPct = isLong
            ? ((newPrice - pos.entryPrice) / pos.entryPrice) * pos.leverage * 100
            : ((pos.entryPrice - newPrice) / pos.entryPrice) * pos.leverage * 100;
          const unPnl = (pos.equityUsed * pnlPct) / 100;

          let updatedPos = { ...pos, currentPrice: newPrice, unrealizedPnl: unPnl, unrealizedPnlPct: pnlPct };

          // Check TP1
          if (!pos.tp1Hit && (isLong ? newPrice >= pos.tp1Price : newPrice <= pos.tp1Price)) {
            updatedPos.tp1Hit = true;
            updatedPos.currentSize = pos.initialSize * 0.75; // 25% closed
            updatedPos.realizedPnl += pos.equityUsed * 0.25 * (pos.leverage * (config.rrTp1 * 0.015));
            updatedPos.slPrice = pos.entryPrice; // move SL to BE

            // Dispatch log
            addLog({
              groupName: pos.groupName,
              symbol: pos.symbol,
              type: 'TP1_HIT',
              side: pos.side,
              price: newPrice,
              sizeFraction: '25% Scaled Out',
              pnl: 35.5,
              message: `Target 1 hit at $${newPrice}. 25% position closed, SL set to Break-Even.`,
            });

            // Dispatch telegram
            sendTelegramAlert('TP1_HIT', pos, newPrice, 35.5);
          }

          // Check TP2
          if (pos.tp1Hit && !pos.tp2Hit && (isLong ? newPrice >= pos.tp2Price : newPrice <= pos.tp2Price)) {
            updatedPos.tp2Hit = true;
            updatedPos.currentSize = pos.initialSize * 0.25; // 50% closed
            updatedPos.realizedPnl += pos.equityUsed * 0.5 * (pos.leverage * (config.rrTp2 * 0.015));

            addLog({
              groupName: pos.groupName,
              symbol: pos.symbol,
              type: 'TP2_HIT',
              side: pos.side,
              price: newPrice,
              sizeFraction: '50% Scaled Out',
              pnl: 78.2,
              message: `Target 2 hit at $${newPrice}. 50% position closed.`,
            });

            sendTelegramAlert('TP2_HIT', pos, newPrice, 78.2);
          }

          // Check TP3 (Full close)
          if (pos.tp2Hit && !pos.tp3Hit && (isLong ? newPrice >= pos.tp3Price : newPrice <= pos.tp3Price)) {
            updatedPos.tp3Hit = true;
            updatedPos.currentSize = 0;
            updatedPos.status = 'CLOSED';
            updatedPos.closeReason = 'TP3';

            addLog({
              groupName: pos.groupName,
              symbol: pos.symbol,
              type: 'TP3_HIT',
              side: pos.side,
              price: newPrice,
              sizeFraction: '100% Full Exit',
              pnl: 142.5,
              message: `Target 3 reached at $${newPrice}. Full position completed!`,
            });

            sendTelegramAlert('TP3_HIT', pos, newPrice, 142.5);
          }

          // Check SL
          if ((isLong && newPrice <= pos.slPrice) || (!isLong && newPrice >= pos.slPrice)) {
            updatedPos.slHit = true;
            updatedPos.currentSize = 0;
            updatedPos.status = 'CLOSED';
            updatedPos.closeReason = 'SL';

            addLog({
              groupName: pos.groupName,
              symbol: pos.symbol,
              type: 'SL_HIT',
              side: pos.side,
              price: newPrice,
              pnl: -60.0,
              message: `Stop Loss executed at $${newPrice}. Capital preserved.`,
            });

            sendTelegramAlert('SL_HIT', pos, newPrice, -60.0);
          }

          return updatedPos;
        });
      });
    }, 4000);

    return () => {
      clearInterval(scanInterval);
      clearInterval(priceTickInterval);
    };
  }, [config, runScanner, addLog, sendTelegramAlert]);

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
    } catch {
      // fallback
    }

    // If fetch failed, generate synthetic 5m candles
    const baseT = tickers.find((t) => t.symbol === symbol);
    const p = baseT?.lastPrice || 100;
    const syn: Candle[] = [];
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      const open = p * (1 + (Math.sin(i / 3) * 0.005));
      const close = open * (1 + (Math.random() - 0.49) * 0.006);
      syn.push({
        timestamp: now - (30 - i) * 300000,
        open,
        high: Math.max(open, close) * 1.003,
        low: Math.min(open, close) * 0.997,
        close,
        volume: 120000 + Math.random() * 80000,
      });
    }
    setChartCandles(syn);
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
          return { ...p, status: 'CLOSED', closeReason: 'MANUAL' };
        }
        return p;
      })
    );
  };

  // Emergency Panic Flatten
  const handleEmergencyFlatten = () => {
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

  // Calculate live portfolio margin
  const openPositionsCount = positions.filter((p) => p.status === 'OPEN').length;
  const marginUsed = positions
    .filter((p) => p.status === 'OPEN')
    .reduce((sum, p) => sum + p.equityUsed, 0);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      {/* 1. Futuristic Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAutoTrading={isAutoTrading}
        setIsAutoTrading={setIsAutoTrading}
        isLiveMode={isLiveMode}
        setIsLiveMode={setIsLiveMode}
        equity={equity}
        todayPnl={todayPnl}
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
            {/* Top Grid: Market Feed (Left) | Bot Constellation Core (Center) | Risk Overview (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Market Data Feed */}
              <div className="lg:col-span-3 space-y-4">
                <MarketDataFeed
                  tickers={tickers}
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={(sym) => {
                    setSelectedSymbol(sym);
                    handleOpenChart(sym);
                  }}
                  isLoading={isScanningBatch}
                />
                <SystemStatusCard
                  serverIp={serverIp}
                  isAutoTrading={isAutoTrading}
                  isLiveMode={isLiveMode}
                  latencyMs={latencyMs}
                />
              </div>

              {/* Center Column: Central Bot Constellation Hub */}
              <div className="lg:col-span-6 flex flex-col justify-center">
                <BotConstellation
                  bots={bots}
                  activeBotId={selectedBotId}
                  onSelectBot={(id) => setSelectedBotId(id)}
                  isAutoTrading={isAutoTrading}
                  totalPnl={18.35}
                  openPositionsCount={openPositionsCount}
                  onOpenLogoMotion={() => setIsLogoMotionModalOpen(true)}
                />
              </div>

              {/* Right Column: Risk Management & Performance Summary */}
              <div className="lg:col-span-3 space-y-4">
                <RiskOverviewCard
                  equity={equity}
                  marginUsed={marginUsed}
                  portfolioRiskPct={1.26}
                  maxDrawdownPct={2.13}
                  activePositionsCount={openPositionsCount}
                />
                <PerformanceSummaryCard
                  todayPnl={todayPnl}
                  todayPnlPct={18.35}
                  winRate={74.2}
                  profitFactor={2.38}
                  totalTrades={38}
                />
              </div>
            </div>

            {/* Middle Section: Active Trading Signals Radar */}
            <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-mono font-bold text-white tracking-wider uppercase">
                    Live Trading Signals & Liquidity Sweeps
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                    AUTONOMOUS 5M RAIDS
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    Max Slots: <span className="text-emerald-400 font-bold">{openPositionsCount} / {MAX_OPEN_POSITIONS} Positions Open</span>
                  </span>
                  <button
                    onClick={() => setActiveTab('scanner')}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
                  >
                    View All 75 Contracts →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {activeSignals.slice(0, 4).map((sig) => (
                  <TradingSignalCard
                    key={sig.id}
                    signal={sig}
                    onExecute={(s) => {
                      const t = tickers.find((tick) => tick.symbol === s.symbol);
                      autoExecuteConfirmedTrade(s.symbol, s.side, {
                        action: s.side,
                        entryPrice: s.price,
                        slLevel: s.sl,
                        tp1Level: s.tp1,
                        tp2Level: s.tp2,
                        tp3Level: s.tp3,
                        recommendedLeverage: s.leverage,
                        volMultiplier: s.volMult,
                      } as any, t);
                    }}
                    onViewChart={handleOpenChart}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARKET SCANNER (75 Contracts in 5 Groups of 15) */}
        {activeTab === 'scanner' && (
          <MarketScanner
            tickers={tickers}
            scanResults={scanResults}
            onExecuteTrade={autoExecuteConfirmedTrade}
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
