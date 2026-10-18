'use client';

import React from 'react';
import { Activity, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { MexcTicker } from '@/lib/mexc';

interface MarketDataFeedProps {
  tickers: MexcTicker[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  isLoading: boolean;
}

export function MarketDataFeed({
  tickers,
  selectedSymbol,
  onSelectSymbol,
  isLoading,
}: MarketDataFeedProps) {
  const displayTickers = tickers.slice(0, 8);

  return (
    <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-3.5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            Market Data Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>UPDATING...</span>
        </div>
      </div>

      {/* Mini Ticker List */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {displayTickers.map((t) => {
          const isUp = t.riseFallRate >= 0;
          const isSelected = selectedSymbol === t.symbol;

          return (
            <div
              key={t.symbol}
              onClick={() => onSelectSymbol(t.symbol)}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-white'
                  : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold">{t.symbol.replace('_USDT', '')}</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-850 text-slate-400">
                    USDT-M
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Vol: ${(t.volume24 / 1000000).toFixed(1)}M
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-white">
                  ${t.lastPrice < 0.01 ? t.lastPrice.toFixed(6) : t.lastPrice.toLocaleString()}
                </div>
                <div
                  className={`flex items-center justify-end text-[10px] font-mono font-semibold ${
                    isUp ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{isUp ? '+' : ''}{(t.riseFallRate * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
