'use client';

import React from 'react';
import { Layers, ArrowUpRight, ArrowDownRight, Shield, Target, XCircle, CheckCircle2, X } from 'lucide-react';
import { MexcPosition } from '@/lib/mexc';

interface PositionsViewProps {
  positions: MexcPosition[];
  onClosePosition: (id: string) => void;
  onViewChart: (symbol: string) => void;
  filterBotId?: string | null;
  filterBotName?: string;
  onClearBotFilter?: () => void;
}

export function PositionsView({
  positions,
  onClosePosition,
  onViewChart,
  filterBotId,
  filterBotName,
  onClearBotFilter,
}: PositionsViewProps) {
  const scopedPositions = filterBotId
    ? positions.filter((p) => p.botId === filterBotId)
    : positions;
  const openPositions = scopedPositions.filter((p) => p.status === 'OPEN');
  const cleanBotName = filterBotName?.replace('Monorid ', '');

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-4 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-mono font-bold text-white tracking-wide">
              {filterBotId && cleanBotName
                ? `BOT WORKSPACE: ${cleanBotName.toUpperCase()}`
                : 'AUTONOMOUS FUTURES POSITIONS & TP PROGRESS'}
            </h2>
            {filterBotId ? (
              <button
                onClick={onClearBotFilter}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold flex items-center gap-1 hover:bg-cyan-900 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
                SHOW ALL BOTS
              </button>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                MAX 8 POSITIONS TOGETHER
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {filterBotId
              ? `Live trades opened by ${cleanBotName || 'this bot'}. Full automatic scaling: 25% closed at TP1 (SL to BE), 50% at TP2, full exit at TP3.`
              : 'Full automatic scaling: 25% closed at TP1 (SL to BE), 50% closed at TP2, remaining 100% full exit at TP3.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono flex items-center gap-2">
            <span className="text-slate-400">{filterBotId ? 'Bot Trades: ' : 'Slots Used: '}</span>
            <span className={`font-black text-sm ${openPositions.length >= 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {filterBotId ? `${openPositions.length} OPEN` : `${openPositions.length} / 8 ACTIVE`}
            </span>
          </div>
        </div>
      </div>

      {/* Open Positions List */}
      {openPositions.length === 0 ? (
        <div className="rounded-xl border border-slate-800/80 bg-[#070c17]/90 p-10 text-center text-slate-400 font-mono">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          {filterBotId ? (
            <>
              <p className="text-sm font-semibold text-slate-300">
                No Live Trades for {cleanBotName || 'This Bot'} Yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                This bot is scanning 75 contracts on 3-minute candles for CRUDE OIL BUY/SELL signals with EMA 200 filter. It will open a trade automatically when a signal confirms.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-300">All 8 Automated Slots Available</p>
              <p className="text-xs text-slate-500 mt-1">
                8 autonomous bots are actively monitoring 75 contracts across 5 volatility tiers for CRUDE OIL BUY/SELL signals with EMA 200 filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {openPositions.map((pos) => {
            const isLong = pos.side === 'LONG';
            const isPnlPositive = pos.unrealizedPnl >= 0;

            return (
              <div
                key={pos.id}
                className="p-4 rounded-xl border border-cyan-950/90 bg-[#060a14]/90 backdrop-blur-md space-y-3"
              >
                {/* Header with Managing Bot Name */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-mono font-black text-white">
                      {pos.symbol.replace('_USDT', '')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                        isLong
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                      }`}
                    >
                      {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {pos.side} {pos.leverage}x
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                      {pos.botName.replace('Monorid ', '')}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 font-semibold">
                    AUTO MANAGED
                  </span>
                </div>

                {/* Numbers */}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Entry Price</span>
                    <span className="font-bold text-white">
                      ${pos.entryPrice < 0.01 ? pos.entryPrice.toFixed(6) : pos.entryPrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Mark Price</span>
                    <span className="font-bold text-white">
                      ${pos.currentPrice < 0.01 ? pos.currentPrice.toFixed(6) : pos.currentPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Unrealized P&L</span>
                    <span
                      className={`font-black text-sm ${
                        isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPnlPositive ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                      <span className="text-[10px] ml-1 font-normal">
                        ({isPnlPositive ? '+' : ''}{pos.unrealizedPnlPct.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </div>

                {/* TP Progress Stage Pipeline */}
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-850 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Position Execution Stages:</span>
                    <span className="text-slate-300">
                      Equity: ${pos.equityUsed.toFixed(0)} USDT
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    {/* TP 1 */}
                    <div
                      className={`p-1.5 rounded border text-center ${
                        pos.tp1Hit
                          ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {pos.tp1Hit && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        <span>TP1 (25%)</span>
                      </div>
                      <span className="text-[9px] block text-slate-300">
                        ${pos.tp1Price < 0.01 ? pos.tp1Price.toFixed(6) : pos.tp1Price.toFixed(2)}
                      </span>
                    </div>

                    {/* TP 2 */}
                    <div
                      className={`p-1.5 rounded border text-center ${
                        pos.tp2Hit
                          ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {pos.tp2Hit && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        <span>TP2 (50%)</span>
                      </div>
                      <span className="text-[9px] block text-slate-300">
                        ${pos.tp2Price < 0.01 ? pos.tp2Price.toFixed(6) : pos.tp2Price.toFixed(2)}
                      </span>
                    </div>

                    {/* TP 3 */}
                    <div
                      className={`p-1.5 rounded border text-center ${
                        pos.tp3Hit
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {pos.tp3Hit && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
                        <span>TP3 (100%)</span>
                      </div>
                      <span className="text-[9px] block text-slate-300">
                        ${pos.tp3Price < 0.01 ? pos.tp3Price.toFixed(6) : pos.tp3Price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-850 text-[10px]">
                    <span className="text-rose-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Stop Loss: ${pos.slPrice < 0.01 ? pos.slPrice.toFixed(6) : pos.slPrice.toFixed(2)}
                    </span>
                    {pos.tp1Hit && (
                      <span className="text-cyan-300 font-bold">
                        ✓ Trailing SL at Break-Even
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => onViewChart(pos.symbol)}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
                  >
                    View Chart & Target Overlay
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
