'use client';

import React, { useState } from 'react';
import { FileText, Filter, Download, Trash2, Send, CheckCircle2, ShieldAlert, Zap, Target } from 'lucide-react';
import { TradeLog, ASSET_GROUPS } from '@/lib/mexc';

interface TradeLogsViewProps {
  logs: TradeLog[];
  onClearLogs: () => void;
}

export function TradeLogsView({ logs, onClearLogs }: TradeLogsViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (selectedGroup !== 'ALL' && log.groupName !== selectedGroup) return false;
    if (selectedType !== 'ALL' && log.type !== selectedType) return false;
    return true;
  });

  const exportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `monorid-trade-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-4 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-mono font-bold text-white tracking-wide">
                SYSTEM AUDIT & GROUP EXECUTION LOGS
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                {logs.length} REGISTERED ACTIONS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Every market sweep, order placement, TP partial close, and Telegram dispatch logged with group attribution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClearLogs}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/60 text-xs font-mono flex items-center gap-1 transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Group and Event Type Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-mono text-slate-400">Group:</span>
          </div>

          <button
            onClick={() => setSelectedGroup('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all border ${
              selectedGroup === 'ALL'
                ? 'bg-cyan-950 border-cyan-400 text-white font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Groups
          </button>

          {ASSET_GROUPS.map((grp) => (
            <button
              key={grp.name}
              onClick={() => setSelectedGroup(grp.name)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all border ${
                selectedGroup === grp.name
                  ? 'bg-cyan-950 border-cyan-400 text-white font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {grp.name}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0b1324] text-slate-400 border-b border-slate-800 text-[10px] uppercase sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Strategy Bot</th>
                <th className="py-2.5 px-3">Group</th>
                <th className="py-2.5 px-3">Asset</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">Scale / P&L</th>
                <th className="py-2.5 px-3">Execution Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No logs recorded for selected criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let badgeColor = 'bg-slate-900 text-slate-400 border-slate-800';
                  let icon = <FileText className="w-3 h-3" />;

                  if (log.type === 'ENTRY') {
                    badgeColor = log.side === 'LONG'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-rose-950 text-rose-300 border-rose-700';
                    icon = <Zap className="w-3 h-3" />;
                  } else if (log.type === 'TP1_HIT') {
                    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-600';
                    icon = <Target className="w-3 h-3" />;
                  } else if (log.type === 'TP2_HIT') {
                    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500';
                    icon = <Target className="w-3 h-3" />;
                  } else if (log.type === 'TP3_HIT') {
                    badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-500';
                    icon = <Target className="w-3 h-3" />;
                  } else if (log.type === 'SL_HIT') {
                    badgeColor = 'bg-rose-950 text-rose-400 border-rose-700';
                    icon = <ShieldAlert className="w-3 h-3" />;
                  } else if (log.type === 'TELEGRAM_DISPATCH') {
                    badgeColor = 'bg-blue-950 text-blue-300 border-blue-700';
                    icon = <Send className="w-3 h-3" />;
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                          {log.botName || log.botCode || 'Apex Momentum'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-cyan-300 font-semibold whitespace-nowrap text-[11px]">
                        {log.groupName || 'Apex Cyber-Volatiles'}
                      </td>
                      <td className="py-2 px-3 text-white font-bold whitespace-nowrap">
                        {log.symbol}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                          {icon}
                          <span>{log.type.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 text-white whitespace-nowrap">
                        ${log.price < 0.01 ? log.price.toFixed(6) : log.price.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {log.pnl !== undefined ? (
                          <span className={`font-bold ${log.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {log.pnl >= 0 ? '+' : ''}${log.pnl.toFixed(2)}
                          </span>
                        ) : log.sizeFraction ? (
                          <span className="text-cyan-300 text-[11px]">{log.sizeFraction}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-300 text-[11px] max-w-xs truncate">
                        {log.message}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
