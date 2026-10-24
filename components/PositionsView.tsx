'use client';

import React from 'react';
import {
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Target,
  XCircle,
  CheckCircle2,
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  Download,
  Server,
} from 'lucide-react';
import { MexcPosition } from '@/lib/mexc';

interface PositionsViewProps {
  positions: MexcPosition[];
  onClosePosition: (id: string) => void;
  onViewChart: (symbol: string) => void;
  filterBotId?: string | null;
  filterBotName?: string;
  onClearBotFilter?: () => void;
  onClearClosedPositions?: () => void;
}

function formatCryptoPrice(val?: number) {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return '—';
  const abs = Math.abs(val);
  if (abs < 0.0001) return `$${val.toFixed(8)}`;
  if (abs < 0.01) return `$${val.toFixed(6)}`;
  if (abs < 1) return `$${val.toFixed(4)}`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PositionsView({
  positions,
  onClosePosition,
  onViewChart,
  filterBotId,
  filterBotName,
  onClearBotFilter,
  onClearClosedPositions,
}: PositionsViewProps) {
  const scopedPositions = filterBotId
    ? positions.filter((p) => p.botId === filterBotId)
    : positions;
  const openPositions = scopedPositions.filter((p) => p.status === 'OPEN');
  const closedPositions = scopedPositions.filter((p) => p.status === 'CLOSED');
  const cleanBotName = filterBotName?.replace('Monorid ', '');

  const totalGrossPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);
  const totalFees = closedPositions.reduce((sum, p) => sum + (p.fee || 0), 0);
  const totalFunding = closedPositions.reduce((sum, p) => sum + (p.fundingFee || 0), 0);
  const totalNetPnl = closedPositions.reduce((sum, p) => {
    const net = p.netRealizedPnl !== undefined ? p.netRealizedPnl : ((p.realizedPnl || 0) - (p.fee || 0) + (p.fundingFee || 0));
    return sum + net;
  }, 0);
  const winCount = closedPositions.filter((p) => {
    const net = p.netRealizedPnl !== undefined ? p.netRealizedPnl : ((p.realizedPnl || 0) - (p.fee || 0) + (p.fundingFee || 0));
    return net > 0;
  }).length;
  const winRate = closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0;

  const exportClosedTrades = () => {
    const blob = new Blob([JSON.stringify(closedPositions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `monorid-trade-history-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5">
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
          {filterBotId && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live trades opened by {cleanBotName || 'this bot'}.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono flex items-center gap-2">
            <span className="text-slate-400">{filterBotId ? 'Bot Trades: ' : 'Active Slots: '}</span>
            <span className={`font-black text-sm ${openPositions.length >= 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {filterBotId ? `${openPositions.length} OPEN` : `${openPositions.length} ACTIVE`}
            </span>
          </div>
          {closedPositions.length > 0 && (
            <button
              onClick={exportClosedTrades}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-750 text-slate-300 text-xs font-mono font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download full closed trade history as JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export History</span>
            </button>
          )}
          {onClearClosedPositions && closedPositions.length > 0 && (
            <button
              onClick={onClearClosedPositions}
              className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold hover:bg-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Clear all closed positions from history"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Clear Closed ({closedPositions.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Open Positions List */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-sm font-mono font-bold text-white tracking-wide">
              ACTIVE POSITIONS ({openPositions.length})
            </h3>
          </div>
        </div>

        {openPositions.length === 0 ? (
          <div className="rounded-xl border border-slate-800/80 bg-[#070c17]/90 p-8 text-center text-slate-400 font-mono">
            <Layers className={`w-10 h-10 text-slate-600 mx-auto ${filterBotId ? 'mb-2' : ''}`} />
            {filterBotId && (
              <>
                <p className="text-sm font-semibold text-slate-300">
                  No Active Trades for {cleanBotName || 'This Bot'} Currently
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Monitoring 90 contracts on 1-minute candles for Monorid signals (Green Dot &gt; EMA 200 or Red Dot &lt; EMA 200). Trades execute automatically with 1:2 TP.
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
                  className="p-4 rounded-xl border border-cyan-950/90 bg-[#060a14]/90 backdrop-blur-md space-y-3 shadow-lg"
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
                        {formatCryptoPrice(pos.entryPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Mark Price</span>
                      <span className="font-bold text-white">
                        {formatCryptoPrice(pos.currentPrice)}
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
                      <span className="text-slate-400">Execution Stages:</span>
                      <span className="text-slate-300">
                        Equity: ${pos.equityUsed.toFixed(0)} USDT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {/* Stop Loss */}
                      <div className="p-2 rounded border text-center bg-rose-950/40 border-rose-500/40 text-rose-300">
                        <div className="flex items-center justify-center gap-1 font-bold">
                          <Shield className="w-3.5 h-3.5 text-rose-400" />
                          <span>Stop Loss (EMA 200)</span>
                        </div>
                        <span className="text-[11px] block font-mono font-bold text-white mt-0.5">
                          {formatCryptoPrice(pos.slPrice)}
                        </span>
                      </div>

                      {/* Take Profit 1:2 */}
                      <div
                        className={`p-2 rounded border text-center transition-all ${
                          pos.tp1Hit || pos.tp2Hit || pos.tp3Hit
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold glow-emerald'
                            : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 font-bold">
                          {(pos.tp1Hit || pos.tp2Hit || pos.tp3Hit) ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Target className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>Take Profit (1:2 • 100% Exit)</span>
                        </div>
                        <span className="text-[11px] block font-mono font-bold text-emerald-300 mt-0.5">
                          {formatCryptoPrice(pos.tp1Price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-850 text-[10px]">
                      <span className="text-slate-400">Strategy Target:</span>
                      <span className="text-cyan-300 font-bold">
                        1:2 Risk-to-Reward Ratio • 100% Exit
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => onViewChart(pos.symbol)}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Inspect 1M Chart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Closed Positions & Realized P&L History Section */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-4 backdrop-blur-md space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-white tracking-wide">
              CLOSED TRADES & REALIZED P&L HISTORY
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-bold border border-slate-700">
              {closedPositions.length} TRADES
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
              WIN RATE: {winRate.toFixed(1)}%
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <Server className="w-2.5 h-2.5 text-cyan-400" />
              SERVER STORAGE: PERSISTENT
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Gross P&L:</span>
              <span className={`font-bold ${totalGrossPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalGrossPnl >= 0 ? '+' : ''}${totalGrossPnl.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Fees:</span>
              <span className="font-bold text-amber-400">
                {totalFees > 0 ? `-$${totalFees.toFixed(4)}` : '$0.0000'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Funding:</span>
              <span className={`font-bold ${totalFunding > 0 ? 'text-emerald-400' : totalFunding < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {totalFunding > 0 ? '+' : totalFunding < 0 ? '-' : ''}${Math.abs(totalFunding).toFixed(4)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-750">
              <span className="text-slate-300 font-bold">Net Realized P&L:</span>
              <span className={`font-black text-sm ${totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalNetPnl >= 0 ? '+' : ''}${totalNetPnl.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {closedPositions.length === 0 ? (
          <div className="py-10 text-center text-slate-500 font-mono text-xs">
            <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-400 font-semibold">No closed trades recorded yet</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Completed executions from Monorid 1:2 Take Profit targets, EMA 200 Stop Loss triggers, and exchange order history will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800/80 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-950/40">
                  <th className="py-2.5 px-3">Closed Time</th>
                  <th className="py-2.5 px-3">Bot / Group</th>
                  <th className="py-2.5 px-3">Contract</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Exit Price</th>
                  <th className="py-2.5 px-3">TP & SL Targets</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">MEXC Fee</th>
                  <th className="py-2.5 px-3 text-right">Funding Fee</th>
                  <th className="py-2.5 px-3 text-right">Gross P&L</th>
                  <th className="py-2.5 px-3 text-right">Net Realized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {closedPositions.map((pos) => {
                  const fee = pos.fee || 0;
                  const fundingFee = pos.fundingFee || 0;
                  const netRealizedPnl = pos.netRealizedPnl !== undefined
                    ? pos.netRealizedPnl
                    : ((pos.realizedPnl || 0) - fee + fundingFee);
                  const isNetWin = netRealizedPnl > 0.0001;
                  const isNetLoss = netRealizedPnl < -0.0001;
                  const isGrossWin = (pos.realizedPnl || 0) > 0.0001;
                  const isGrossLoss = (pos.realizedPnl || 0) < -0.0001;
                  const isZeroPnl = !isGrossWin && !isGrossLoss;
                  const isLong = pos.side === 'LONG';
                  const closeTime = pos.closedAt
                    ? new Date(pos.closedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                      })
                    : '—';

                  return (
                    <tr key={pos.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {closeTime}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-cyan-300 font-bold text-[11px]">
                            {pos.botName?.replace('Monorid ', '') || 'Quant Bot'}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {pos.groupName || 'Apex Volatiles'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold whitespace-nowrap">
                        {pos.symbol.replace('_USDT', '')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                          }`}
                        >
                          {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap font-mono">
                        {formatCryptoPrice(pos.entryPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap font-mono font-semibold">
                        {formatCryptoPrice(pos.exitPrice)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-emerald-400 font-medium">
                            TP: {formatCryptoPrice(pos.tp1Price)}
                          </span>
                          <span className="text-rose-400 font-medium">
                            SL: {formatCryptoPrice(pos.slPrice)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            !isZeroPnl && pos.closeReason?.startsWith('TP')
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                              : !isZeroPnl && pos.closeReason === 'SL'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isZeroPnl ? 'MANUAL' : (pos.closeReason || 'MANUAL')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] text-amber-400/90 font-semibold">
                        {fee > 0 ? `-$${fee.toFixed(4)}` : '$0.0000'}
                      </td>
                      <td className={`py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] font-semibold ${
                        fundingFee > 0 ? 'text-emerald-400' : fundingFee < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {fundingFee > 0 ? `+$${fundingFee.toFixed(4)}` : fundingFee < 0 ? `-$${Math.abs(fundingFee).toFixed(4)}` : '$0.0000'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                        <span className={isGrossWin ? 'text-emerald-400' : isGrossLoss ? 'text-rose-400' : 'text-slate-400'}>
                          {isGrossWin ? '+' : ''}${(pos.realizedPnl || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold">
                        <span className={isNetWin ? 'text-emerald-400' : isNetLoss ? 'text-rose-400' : 'text-slate-400'}>
                          {isNetWin ? '+' : ''}${netRealizedPnl.toFixed(2)}
                        </span>
                        {(() => {
                          const netPct = pos.equityUsed && pos.equityUsed > 0
                            ? (netRealizedPnl / pos.equityUsed) * 100
                            : (pos.realizedPnlPct !== undefined ? (netRealizedPnl >= 0 ? Math.abs(pos.realizedPnlPct) : -Math.abs(pos.realizedPnlPct)) : undefined);
                          if (netPct === undefined || netPct === null) return null;
                          return (
                            <span className={`text-[10px] ml-1 font-normal ${isNetWin ? 'text-emerald-300' : 'text-rose-300'}`}>
                              ({netPct >= 0 ? '+' : ''}{netPct.toFixed(2)}%)
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
