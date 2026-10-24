'use client';

import React, { useState } from 'react';
import {
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Scan,
  Zap,
  Target,
  Shield,
  Eye,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { MexcTicker, ASSET_GROUPS } from '@/lib/mexc';
import { SignalResult } from '@/lib/strategy';

interface MarketScannerProps {
  tickers: MexcTicker[];
  scanResults: Record<string, SignalResult>;
  onViewChart: (symbol: string) => void;
  onRefreshScan: () => void;
  isScanningBatch: boolean;
  scanDurationMs?: number;
  nonActivatedContracts?: Set<string>;
  lossCooldowns?: Map<string, number>;
}

function formatCryptoPrice(val?: number) {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (val === 0) return '$0.00';
  const abs = Math.abs(val);
  if (abs < 0.0001) return `$${val.toFixed(8)}`;
  if (abs < 0.01) return `$${val.toFixed(6)}`;
  if (abs < 1) return `$${val.toFixed(4)}`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MarketScanner({
  tickers,
  scanResults,
  onViewChart,
  onRefreshScan,
  isScanningBatch,
  scanDurationMs,
  nonActivatedContracts,
  lossCooldowns,
}: MarketScannerProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('Apex Cyber-Volatiles');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentGroupTickers = tickers.filter((t) => t.groupName === selectedGroup);
  const filteredTickers = searchQuery
    ? tickers.filter((t) => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    : currentGroupTickers;

  return (
    <div className="space-y-4">
      {/* Top Banner & Group Selector */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-4 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Scan className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-mono font-bold text-white tracking-wide">
                AUTOMATED 1M MARKET SCANNER (90 FUTURES CONTRACTS)
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                15 ASSETS / GROUP • 6 GROUPS
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                PARALLEL ENGINE {scanDurationMs ? `(${(scanDurationMs / 1000).toFixed(1)}s)` : '(<2s)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0 sm:w-56 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search contract..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/70"
              />
            </div>

            {/* Refresh Scan Button */}
            <button
              onClick={onRefreshScan}
              disabled={isScanningBatch}
              className="flex w-36 shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningBatch ? 'animate-spin' : ''}`} />
              <span>{isScanningBatch ? 'Scanning...' : 'Rescan 1M'}</span>
            </button>
          </div>
        </div>

        {/* Group Selector Pills (fits visible area, no horizontal overflow) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3">
          {ASSET_GROUPS.map((grp, index) => {
            const count = tickers.filter((t) => t.groupName === grp.name).length;
            const isSelected = selectedGroup === grp.name && !searchQuery;

            return (
              <button
                key={grp.name}
                onClick={() => {
                  setSelectedGroup(grp.name);
                  setSearchQuery('');
                }}
                title={`${grp.name} — ${grp.description}`}
                className={`flex items-center justify-center gap-2 min-w-0 px-2.5 py-2 rounded-lg text-[11px] font-mono transition-all border ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-sm glow-cyan font-bold'
                    : 'bg-slate-900/60 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <span className="truncate">GROUP 0{index + 1}: {grp.name}</span>
                <span className="shrink-0 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-cyan-300 font-bold">
                  {count || 15}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Asset Table / Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredTickers.map((ticker) => {
          const analysis = scanResults[ticker.symbol];
          const isUp = ticker.riseFallRate >= 0;
          const hasBuy = analysis?.action === 'BUY';
          const hasSell = analysis?.action === 'SELL';
          const hasSignal = hasBuy || hasSell;

          return (
            <div
              key={ticker.symbol}
              className={`neon-border border p-3.5 rounded-xl backdrop-blur-md transition-all ${
                hasBuy
                  ? 'neon-buy border-emerald-500/50 bg-gradient-to-br from-[#061418] to-[#040912] shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : hasSell
                  ? 'neon-sell border-rose-500/50 bg-gradient-to-br from-[#18080c] to-[#040912] shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                  : 'neon-normal border-[#4169e1]/30 bg-[#070c17]/90 shadow-[0_0_15px_rgba(65,105,225,0.12)] hover:border-[#4169e1]/60'
              }`}
            >
              {/* Asset Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-black text-white">
                    {ticker.symbol.replace('_USDT', '')}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-850 text-slate-400">
                    {ticker.groupName.split(' ')[0]}
                  </span>
                </div>

                {/* Signal Badge */}
                {hasBuy && (
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 animate-pulse flex items-center gap-1">
                    <Zap className="w-3 h-3" /> BUY
                  </span>
                )}
                {hasSell && (
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/60 animate-pulse flex items-center gap-1">
                    <Zap className="w-3 h-3" /> SELL
                  </span>
                )}
                {!hasSignal && (
                  <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-900 text-slate-400 border border-slate-800">
                    SCANNING 1M
                  </span>
                )}
              </div>

              {/* Price & Volatility */}
              <div className="grid grid-cols-2 gap-2 my-2.5 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mark Price</span>
                  <span className="font-bold text-white text-sm">
                    {formatCryptoPrice(ticker.lastPrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">24h Volatility</span>
                  <span className={`font-bold flex items-center justify-end gap-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isUp ? '+' : ''}{(ticker.riseFallRate * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Strategy Engine Telemetry */}
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-850 space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Monorid (WT1 / WT2):</span>
                  <span className="font-semibold text-cyan-300">
                    {analysis?.wt1 !== undefined ? `${analysis.wt1.toFixed(1)} / ${analysis.wt2.toFixed(1)}` : '—'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Monorid Dot:</span>
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    (analysis?.monoridDot || analysis?.cipherDot) === 'GREEN'
                      ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 animate-pulse'
                      : (analysis?.monoridDot || analysis?.cipherDot) === 'RED'
                      ? 'bg-rose-950 border border-rose-500 text-rose-300 animate-pulse'
                      : 'bg-slate-900 text-slate-400'
                  }`}>
                    {(analysis?.monoridDot || analysis?.cipherDot) === 'GREEN' ? '🟢 GREEN DOT (OS)' : (analysis?.monoridDot || analysis?.cipherDot) === 'RED' ? '🔴 RED DOT (OB)' : 'NEUTRAL'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">EMA 200:</span>
                  <span className={`font-semibold ${
                    (ticker.lastPrice || 0) >= (analysis?.ema || 0) ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {formatCryptoPrice(analysis?.ema)}
                    <span className="text-[9px] ml-1 opacity-80">
                      {(ticker.lastPrice || 0) >= (analysis?.ema || 0) ? '(Above)' : '(Below)'}
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Leverage / Sizing:</span>
                  <span className="text-emerald-400 font-bold">
                    {analysis?.recommendedLeverage ?? 7}x • 10% Equity
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className={`font-bold flex items-center gap-1.5 ${
                    (analysis?.confidence ?? 0) >= 80 ? 'text-emerald-300' : 'text-amber-400'
                  }`}>
                    {analysis?.confidence ?? 0}%
                    <span className={`text-[8px] px-1 py-0.2 rounded font-mono font-bold uppercase tracking-wider ${
                      (analysis?.confidence ?? 0) >= 80
                        ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                    }`}>
                      {(analysis?.confidence ?? 0) >= 80 ? '≥ 80%' : '< 80%'}
                    </span>
                  </span>
                </div>

                {hasSignal && (
                  <div className="pt-1 border-t border-slate-800 space-y-0.5 text-[10px]">
                    <div className="flex justify-between text-rose-400">
                      <span>🛑 SL (EMA 200):</span>
                      <span className="font-semibold">{formatCryptoPrice(analysis?.slLevel)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>🎯 TP (1:2 Target • 100%):</span>
                      <span className="font-semibold">{formatCryptoPrice(analysis?.tpLevel || analysis?.tp1Level)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions & Status */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => onViewChart(ticker.symbol)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-center gap-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Inspect 1M Chart</span>
                </button>

                {hasSignal ? (
                  nonActivatedContracts?.has(ticker.symbol) ? (
                    <div
                      title="MEXC API execution disabled for this contract by exchange (apiAllowed: false)"
                      className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 border bg-amber-950/80 border-amber-500/60 text-amber-300"
                    >
                      <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">MEXC API RESTRICTED</span>
                    </div>
                  ) : lossCooldowns && lossCooldowns.has(ticker.symbol) && (lossCooldowns.get(ticker.symbol)! > Date.now()) ? (
                    <div
                      title="Post-loss protection active: coin is paused for 30 minutes following a Stop Loss to prevent revenge churn"
                      className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 border bg-blue-950/80 border-blue-500/60 text-blue-300"
                    >
                      <Shield className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="truncate">COOLDOWN ({Math.ceil((lossCooldowns.get(ticker.symbol)! - Date.now()) / 60000)}m)</span>
                    </div>
                  ) : (analysis?.confidence ?? 0) < 80 ? (
                    <div
                      title="Trade not executed: Confidence score is below 80%. Required: ≥ 80%"
                      className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 border bg-amber-950/80 border-amber-500/60 text-amber-300"
                    >
                      <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">FILTERED (Score &lt; 80%)</span>
                    </div>
                  ) : (
                    <div
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 border ${
                        hasBuy
                          ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                          : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
                      <span className="truncate">
                        {analysis?.candleTiming === 'SAME_CANDLE' ? '⚡ EXEC (>75%)' : 'AUTO-DISPATCH (>75%)'}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex-1 py-1.5 rounded-lg bg-slate-900/60 border border-slate-850 text-[10px] font-mono text-slate-400 flex items-center justify-center gap-1">
                    <Scan className="w-3 h-3 text-cyan-500" />
                    <span>SCANNING 1M SIGNALS</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
