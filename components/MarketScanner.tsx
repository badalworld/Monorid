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

interface ScannedAssetInfo {
  ticker: MexcTicker;
  analysis?: SignalResult;
  isScanning?: boolean;
}

interface MarketScannerProps {
  tickers: MexcTicker[];
  scanResults: Record<string, SignalResult>;
  onViewChart: (symbol: string) => void;
  onRefreshScan: () => void;
  isScanningBatch: boolean;
}

export function MarketScanner({
  tickers,
  scanResults,
  onViewChart,
  onRefreshScan,
  isScanningBatch,
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
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-mono font-bold text-white tracking-wide">
                AUTOMATED 3M MARKET SCANNER (75 FUTURES CONTRACTS)
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                15 ASSETS / GROUP
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
              <span>{isScanningBatch ? 'Scanning...' : 'Rescan 3M'}</span>
            </button>
          </div>
        </div>

        {/* Group Selector Pills (fits visible area, no horizontal overflow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-3">
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
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
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
                    SCANNING 3M
                  </span>
                )}
              </div>

              {/* Price & Volatility */}
              <div className="grid grid-cols-2 gap-2 my-2.5 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mark Price</span>
                  <span className="font-bold text-white text-sm">
                    ${ticker.lastPrice < 0.01 ? ticker.lastPrice.toFixed(6) : ticker.lastPrice.toLocaleString()}
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
                  <span className="text-slate-400">RSI ({analysis?.rsi ?? 50}):</span>
                  <span className={`font-semibold ${
                    (analysis?.rsi ?? 50) > 70 ? 'text-rose-400' : (analysis?.rsi ?? 50) < 30 ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    {(analysis?.rsi ?? 50).toFixed(1)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">SMA {analysis?.sma ? `(${analysis.sma.toFixed(2)})` : ''}:</span>
                  <span className={`font-semibold ${
                    analysis?.emaFilterOK ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {analysis?.emaFilterOK ? '✓ CONFIRMED' : '✗ FILTERED'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">EMA 200:</span>
                  <span className="text-cyan-400 font-semibold">
                    ${analysis?.ema?.toFixed(2) ?? '—'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Leverage / Sizing:</span>
                  <span className="text-emerald-400 font-bold">
                    {analysis?.recommendedLeverage ?? 12}x • 10% Equity
                  </span>
                </div>

                {hasSignal && (
                  <div className="pt-1 border-t border-slate-800 space-y-0.5 text-[10px]">
                    <div className="flex justify-between text-rose-400">
                      <span>🛑 SL:</span>
                      <span className="font-semibold">${analysis?.slLevel?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>🎯 TP1 (25%):</span>
                      <span className="font-semibold">${analysis?.tp1Level?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-300">
                      <span>🎯 TP2 (50%):</span>
                      <span className="font-semibold">${analysis?.tp2Level?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-cyan-300 font-bold">
                      <span>🏆 TP3 (Full):</span>
                      <span>${analysis?.tp3Level?.toFixed(4)}</span>
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
                  <span>Inspect 3M Chart</span>
                </button>

                {hasSignal ? (
                  <div
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 border ${
                      hasBuy
                        ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>AUTO-DISPATCHED</span>
                  </div>
                ) : (
                  <div className="flex-1 py-1.5 rounded-lg bg-slate-900/60 border border-slate-850 text-[10px] font-mono text-slate-400 flex items-center justify-center gap-1">
                    <Scan className="w-3 h-3 text-cyan-500" />
                    <span>SCANNING 3M SIGNALS</span>
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
