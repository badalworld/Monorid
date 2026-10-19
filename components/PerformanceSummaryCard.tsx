'use client';

import React from 'react';
import { TrendingUp, Award, BarChart3 } from 'lucide-react';

interface PerformanceSummaryCardProps {
  todayPnl: number;
  todayPnlPct: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

export function PerformanceSummaryCard({
  todayPnl,
  todayPnlPct,
  winRate,
  profitFactor,
  totalTrades,
}: PerformanceSummaryCardProps) {
  // SVG points for mini glowing equity curve
  const points = [
    { x: 0, y: 35 },
    { x: 30, y: 30 },
    { x: 60, y: 38 },
    { x: 90, y: 24 },
    { x: 120, y: 28 },
    { x: 150, y: 18 },
    { x: 180, y: 22 },
    { x: 210, y: 12 },
    { x: 240, y: 8 },
  ];

  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  const areaD = `${pathD} L 240 50 L 0 50 Z`;

  return (
    <div className="h-full flex flex-col rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-3.5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            Performance Summary
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 font-semibold">
          ALGO V2.4
        </span>
      </div>

      {/* Main Today's P&L Callout */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-[10px] text-slate-400 block font-mono">TODAY&apos;S P&L</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">
              +{todayPnlPct.toFixed(2)}%
            </span>
            <span className="text-xs font-mono text-emerald-300 font-semibold">
              (+${todayPnl.toFixed(2)})
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block font-mono">WIN RATE</span>
          <span className="text-sm font-bold text-white font-mono">{winRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Mini Glowing Equity Graph */}
      <div className="relative w-full flex-1 min-h-14 bg-slate-950/80 rounded-lg p-1 border border-slate-850 overflow-hidden mb-2.5">
        <svg className="w-full h-full" viewBox="0 0 240 50" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#pnlGrad)" />
          <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" />
        </svg>
      </div>

      {/* Bottom KPI metrics */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="p-1.5 rounded bg-slate-900/40 border border-slate-850 flex justify-between">
          <span className="text-slate-400">Profit Factor:</span>
          <span className="text-cyan-300 font-bold">{profitFactor.toFixed(2)}</span>
        </div>
        <div className="p-1.5 rounded bg-slate-900/40 border border-slate-850 flex justify-between">
          <span className="text-slate-400">Total Trades:</span>
          <span className="text-white font-bold">{totalTrades}</span>
        </div>
      </div>
    </div>
  );
}
