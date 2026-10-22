'use client';

import React, { useState } from 'react';
import { TrendingUp, Award, BarChart3, X, Clock, DollarSign, Target } from 'lucide-react';

interface ClosedPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  realizedPnl: number;
  realizedPnlPct?: number;
  closedAt?: number;
  slHit?: boolean;
  tp1Hit?: boolean;
  tp2Hit?: boolean;
  tp3Hit?: boolean;
  fee?: number;
  fundingFee?: number;
  netRealizedPnl?: number;
  slPrice?: number;
  tp1Price?: number;
}

interface PerformanceSummaryCardProps {
  todayPnl: number;
  todayPnlPct: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  closedPositions?: ClosedPosition[];
  pnlHistory?: number[];
}

function formatCryptoPrice(val?: number) {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return '—';
  const abs = Math.abs(val);
  if (abs < 0.0001) return `$${val.toFixed(8)}`;
  if (abs < 0.01) return `$${val.toFixed(6)}`;
  if (abs < 1) return `$${val.toFixed(4)}`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PerformanceSummaryCard({
  todayPnl,
  todayPnlPct,
  winRate,
  profitFactor,
  totalTrades,
  closedPositions = [],
  pnlHistory = [],
}: PerformanceSummaryCardProps) {
  const [showClosedPositions, setShowClosedPositions] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  const isProfit = mounted ? todayPnl >= 0 : true;
  const pnlColor = !mounted ? 'text-emerald-400' : isProfit ? 'text-emerald-400' : 'text-rose-400';
  const chartColor = !mounted ? '#10b981' : isProfit ? '#10b981' : '#f43f5e';
  const chartGradientId = !mounted ? 'pnlGradProfit' : isProfit ? 'pnlGradProfit' : 'pnlGradLoss';
  
  // Dynamically calculate equity curve points from closed trades and live P&L
  const { pathD, areaD, lastPoint } = React.useMemo(() => {
    let vals: number[] = [];

    if (closedPositions && closedPositions.length > 0) {
      // Sort closed positions chronologically
      const sorted = [...closedPositions].sort(
        (a, b) => (a.closedAt || 0) - (b.closedAt || 0)
      );

      // Start baseline at 0
      vals.push(0);
      let runningPnl = 0;
      for (const pos of sorted) {
        const net = pos.netRealizedPnl !== undefined ? pos.netRealizedPnl : ((pos.realizedPnl || 0) - (pos.fee || 0) + (pos.fundingFee || 0));
        runningPnl += net;
        vals.push(runningPnl);
      }
      // Add current live P&L as the latest real-time point
      vals.push(todayPnl);
    } else if (pnlHistory && pnlHistory.length >= 2) {
      vals = [...pnlHistory, todayPnl];
    } else {
      // Starting state: smooth curve to todayPnl
      vals = [0, todayPnl * 0.3, todayPnl * 0.6, todayPnl * 0.85, todayPnl];
    }

    // Keep at most last 40 data points for sharp resolution
    if (vals.length > 40) {
      vals = vals.slice(-40);
    }

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = (max - min) === 0 ? 1 : max - min;
    const len = vals.length;

    // Plot inside 240x50 with 8px top/bottom padding
    const plotH = 34;
    const topPad = 8;

    const pts = vals.map((val, idx) => {
      const x = Number(((idx / Math.max(1, len - 1)) * 240).toFixed(1));
      const norm = (val - min) / range;
      const y = Number((50 - topPad - norm * plotH).toFixed(1));
      return { x, y };
    });

    const pD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
    const aD = `${pD} L 240 50 L 0 50 Z`;
    const last = pts[pts.length - 1] || { x: 240, y: 25 };

    return { pathD: pD, areaD: aD, lastPoint: last };
  }, [closedPositions, todayPnl, pnlHistory]);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="h-full flex flex-col rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-3.5 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`} />
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
              <span className={`text-xl sm:text-2xl font-black ${pnlColor} font-mono tracking-tight`}>
                {mounted ? (
                  `${isProfit ? '+' : ''}${todayPnlPct.toFixed(2)}%`
                ) : (
                  '+0.00%'
                )}
              </span>
              <span className={`text-xs font-mono ${!mounted ? 'text-emerald-300' : isProfit ? 'text-emerald-300' : 'text-rose-300'} font-semibold`}>
                ({mounted ? `${isProfit ? '+' : ''}$${todayPnl.toFixed(2)}` : '+$0.00'})
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">WIN RATE</span>
            <span className="text-sm font-bold text-white font-mono">{mounted ? `${winRate.toFixed(1)}%` : '0.0%'}</span>
          </div>
        </div>

        {/* Mini Glowing Equity Graph */}
        <div className="relative w-full flex-1 min-h-14 bg-slate-950/80 rounded-lg p-1 border border-slate-850 overflow-hidden mb-2.5">
          <svg className="w-full h-full" viewBox="0 0 240 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity="0.45" />
                <stop offset="100%" stopColor={chartColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#${chartGradientId})`} />
            <path d={pathD} fill="none" stroke={chartColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={chartColor} className="animate-pulse" />
          </svg>
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[9px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
            <span className={`w-1.5 h-1.5 rounded-full ${isProfit ? 'bg-emerald-400' : 'bg-rose-400'} animate-ping`} />
            <span>LIVE P&L</span>
          </div>
        </div>

        {/* Bottom KPI metrics */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-2">
          <div className="p-1.5 rounded bg-slate-900/40 border border-slate-850 flex justify-between">
            <span className="text-slate-400">Profit Factor:</span>
            <span className="text-cyan-300 font-bold">{mounted ? profitFactor.toFixed(2) : '0.00'}</span>
          </div>
          <div className="p-1.5 rounded bg-slate-900/40 border border-slate-850 flex justify-between">
            <span className="text-slate-400">Total Trades:</span>
            <span className="text-white font-bold">{mounted ? totalTrades : 0}</span>
          </div>
        </div>

        {/* View Closed Positions Button */}
        <button
          onClick={() => setShowClosedPositions(true)}
          className="w-full px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-semibold hover:bg-cyan-900/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>View Closed Positions ({mounted ? totalTrades : 0})</span>
        </button>
      </div>

      {/* Closed Positions Modal */}
      {showClosedPositions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#030712] border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden my-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/50 bg-[#050e1c]/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                  <Clock className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-sm tracking-wide">Closed Positions History</h2>
                  <p className="text-slate-400 text-[10px] font-mono mt-0.5">
                    {totalTrades} trades • Win Rate: {winRate.toFixed(1)}% • Profit Factor: {profitFactor.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClosedPositions(false)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-400 hover:text-cyan-300 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {closedPositions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-mono">
                  No closed positions yet
                </div>
              ) : (
                <div className="space-y-2">
                  {closedPositions.map((pos, idx) => {
                    const fee = pos.fee || 0;
                    const fundingFee = pos.fundingFee || 0;
                    const netPnl = pos.netRealizedPnl !== undefined ? pos.netRealizedPnl : (pos.realizedPnl - fee + fundingFee);
                    const isWin = netPnl > 0;
                    const netPct = pos.realizedPnlPct !== undefined ? (isWin ? Math.abs(pos.realizedPnlPct) : -Math.abs(pos.realizedPnlPct)) : undefined;
                    return (
                      <div
                        key={pos.id || idx}
                        className={`p-3 rounded-lg border ${
                          isWin 
                            ? 'bg-emerald-950/20 border-emerald-500/30' 
                            : 'bg-rose-950/20 border-rose-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-sm font-mono">{pos.symbol}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                              pos.side === 'LONG' 
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50' 
                                : 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                            }`}>
                              {pos.side}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold font-mono ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}${netPnl.toFixed(2)}
                              {netPct !== undefined && (
                                <span className="text-xs ml-1 font-normal">({netPct >= 0 ? '+' : ''}{netPct.toFixed(2)}%)</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Gross: {pos.realizedPnl >= 0 ? '+' : ''}${pos.realizedPnl.toFixed(2)} | Fee: {fee > 0 ? `-$${fee.toFixed(4)}` : '$0.0000'}{fundingFee !== 0 ? ` | Funding: ${fundingFee > 0 ? '+' : '-'}$${Math.abs(fundingFee).toFixed(4)}` : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                          <div>
                            <span className="text-slate-500 block">Entry</span>
                            <span className="text-slate-200">{formatCryptoPrice(pos.entryPrice)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Exit</span>
                            <span className="text-slate-200">{formatCryptoPrice(pos.exitPrice)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">TP / SL Target</span>
                            <span className="text-slate-200">
                              {formatCryptoPrice(pos.tp1Price)} / {formatCryptoPrice(pos.slPrice)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Result</span>
                            <div className="flex gap-1 items-center">
                              {isWin ? (
                                <span className="text-emerald-400 font-bold" title="1:2 Take Profit Hit">🎯 1:2 TP</span>
                              ) : (
                                <span className="text-rose-400 font-bold" title="EMA 200 Stop Loss Hit">🛑 SL</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
