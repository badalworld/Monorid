'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Eye, Shield, Target, Zap } from 'lucide-react';
import { SignalResult } from '@/lib/strategy';

export interface ActiveSignalItem {
  id: string;
  symbol: string;
  groupName: string;
  side: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  leverage: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rsi: number;
  emaFilterOK: boolean;
  timestamp: number;
  status: 'ACTIVE' | 'EXECUTED';
}

interface TradingSignalCardProps {
  signal: ActiveSignalItem;
  onExecute: (signal: ActiveSignalItem) => void;
  onViewChart: (symbol: string) => void;
  isExecuting?: boolean;
}

export function TradingSignalCard({
  signal,
  onExecute,
  onViewChart,
  isExecuting,
}: TradingSignalCardProps) {
  const isBuy = signal.side === 'BUY';

  return (
    <div className={`p-3 rounded-xl border backdrop-blur-md transition-all ${
      isBuy
        ? 'border-emerald-500/40 bg-gradient-to-br from-[#06141a]/90 to-[#040912]/95 hover:border-emerald-400'
        : 'border-rose-500/40 bg-gradient-to-br from-[#1a080d]/90 to-[#040912]/95 hover:border-rose-400'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-black text-white">
            {signal.symbol.replace('_USDT', '')}
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-850 text-slate-400">
            {signal.leverage}x LEV
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 ${
              isBuy
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
            }`}
          >
            {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {signal.side}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-2 my-2.5 text-xs font-mono">
        <div>
          <span className="text-[10px] text-slate-400 block">Entry Price</span>
          <span className="font-bold text-white tracking-wide">
            ${signal.price < 0.01 ? signal.price.toFixed(6) : signal.price.toLocaleString()}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block">Confidence</span>
          <span className="font-bold text-cyan-300 flex items-center justify-end gap-1">
            <Zap className="w-3 h-3 text-cyan-400" />
            {signal.confidence}%
          </span>
        </div>
      </div>

      {/* TP / SL Levels preview */}
      <div className="p-2 rounded bg-slate-950/70 border border-slate-850 text-[10px] font-mono space-y-1 mb-2.5">
        <div className="flex justify-between items-center text-rose-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" /> SL:
          </span>
          <span className="font-semibold">${signal.sl < 0.01 ? signal.sl.toFixed(6) : signal.sl.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-emerald-400">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" /> TP1 (25%):
          </span>
          <span className="font-semibold">${signal.tp1 < 0.01 ? signal.tp1.toFixed(6) : signal.tp1.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-emerald-300">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" /> TP2 (50%):
          </span>
          <span className="font-semibold">${signal.tp2 < 0.01 ? signal.tp2.toFixed(6) : signal.tp2.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-cyan-300 font-bold">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3 text-cyan-400" /> TP3 (Full):
          </span>
          <span>${signal.tp3 < 0.01 ? signal.tp3.toFixed(6) : signal.tp3.toFixed(2)}</span>
        </div>
      </div>

      {/* Automated Status Footer */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewChart(signal.symbol)}
          className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-center gap-1 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span>Inspect 3M Chart</span>
        </button>

        <div className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 border ${
          isBuy
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
        }`}>
          <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>AUTO-EXECUTING</span>
        </div>
      </div>
    </div>
  );
}
