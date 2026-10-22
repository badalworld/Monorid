'use client';

import React from 'react';
import { ShieldAlert, PieChart, Layers, Gauge } from 'lucide-react';

interface RiskOverviewCardProps {
  equity: number;
  availableBalance?: number | null;
  marginUsed: number;
  portfolioRiskPct: number;
  maxDrawdownPct: number;
  activePositionsCount: number;
}

export function RiskOverviewCard({
  equity,
  availableBalance,
  marginUsed,
  portfolioRiskPct,
  maxDrawdownPct,
  activePositionsCount,
}: RiskOverviewCardProps) {
  const freeMargin = availableBalance !== undefined && availableBalance !== null ? availableBalance : Math.max(0, equity - marginUsed);
  const isBalanceLow = (availableBalance !== undefined && availableBalance !== null && availableBalance < 0.70) || ((availableBalance === undefined || availableBalance === null) && equity > 0 && equity < 0.70);
  const marginPct = equity > 0 ? (marginUsed / equity) * 100 : 0;
  const freePct = 100 - marginPct;

  // SVG circular gauge calculation
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (marginPct / 100) * circumference;

  return (
    <div className="h-full rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-3.5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            Risk & Portfolio
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isBalanceLow ? (
            <span className="text-[10px] font-mono text-rose-400 font-bold bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/40">
              SAFETY: &lt; $0.70
            </span>
          ) : (
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              MAX 20% / TRADE
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs font-mono">
        <div className="p-2 rounded bg-slate-900/40 border border-slate-850">
          <span className="text-[10px] text-slate-400 block">PORTFOLIO RISK</span>
          <span className="text-sm font-bold text-emerald-400">{portfolioRiskPct.toFixed(2)}%</span>
        </div>
        <div className="p-2 rounded bg-slate-900/40 border border-slate-850">
          <span className="text-[10px] text-slate-400 block">MAX DRAWDOWN</span>
          <span className="text-sm font-bold text-cyan-300">{maxDrawdownPct.toFixed(2)}%</span>
        </div>
      </div>

      {/* Donut Allocation */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-850">
        <div className="flex items-center gap-3">
          {/* Mini Donut Chart */}
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-cyan-500 transition-all duration-700"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute text-[9px] font-mono font-bold text-white">
              {marginPct.toFixed(0)}%
            </div>
          </div>

          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-slate-400">Futures Margin:</span>
              <span className="text-white font-bold">${marginUsed.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              <span className="text-slate-400">Free USDT:</span>
              <span className="text-white font-bold">${freeMargin.toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-[10px] text-slate-400 block">Positions</span>
          <span className="text-xs font-bold text-emerald-400">{activePositionsCount} Active</span>
        </div>
      </div>
    </div>
  );
}
