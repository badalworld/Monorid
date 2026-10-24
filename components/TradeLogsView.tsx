'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Filter,
  Download,
  Trash2,
  Send,
  CheckCircle2,
  ShieldAlert,
  Zap,
  Target,
  Search,
  Radio,
  Play,
  Pause,
  XCircle,
  Activity,
  Layers,
  Server,
} from 'lucide-react';
import { TradeLog, ASSET_GROUPS, TradeLogType } from '@/lib/mexc';

interface TradeLogsViewProps {
  logs: TradeLog[];
  onClearLogs: () => void;
}

type CategoryTab = 'ALL' | 'TRADES' | 'SIGNALS' | 'SCANNER' | 'SYSTEM_STATUS';

const TRADES_TYPES = new Set<TradeLogType>([
  'TRADE_EXECUTED',
  'ENTRY',
  'TP_HIT',
  'TP1_HIT',
  'TP2_HIT',
  'TP3_HIT',
  'SL_HIT',
  'TPSL',
]);

const SIGNALS_TYPES = new Set<TradeLogType>([
  'NEW_OPPORTUNITY',
  'ELIMINATED_OPPORTUNITY',
  'SCAN_SIGNAL',
]);

const SCANNER_TYPES = new Set<TradeLogType>([
  'MARKET_SCAN',
]);

const SYSTEM_TYPES = new Set<TradeLogType>([
  'MONORID_RUNNING',
  'MONORID_STOP',
  'SYSTEM_STATUS',
  'TELEGRAM_DISPATCH',
]);

export function TradeLogsView({ logs, onClearLogs }: TradeLogsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryTab>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Counts for tabs
  const counts = useMemo(() => {
    let trades = 0;
    let signals = 0;
    let scanner = 0;
    let system = 0;

    for (const log of logs) {
      if (TRADES_TYPES.has(log.type)) trades++;
      else if (SIGNALS_TYPES.has(log.type)) signals++;
      else if (SCANNER_TYPES.has(log.type)) scanner++;
      else if (SYSTEM_TYPES.has(log.type)) system++;
    }

    return { all: logs.length, trades, signals, scanner, system };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Group filter
      if (selectedGroup !== 'ALL' && log.groupName !== selectedGroup) return false;

      // Category tab filter
      if (selectedCategory === 'TRADES' && !TRADES_TYPES.has(log.type)) return false;
      if (selectedCategory === 'SIGNALS' && !SIGNALS_TYPES.has(log.type)) return false;
      if (selectedCategory === 'SCANNER' && !SCANNER_TYPES.has(log.type)) return false;
      if (selectedCategory === 'SYSTEM_STATUS' && !SYSTEM_TYPES.has(log.type)) return false;

      // Text Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSymbol = log.symbol?.toLowerCase().includes(q);
        const matchMsg = log.message?.toLowerCase().includes(q);
        const matchBot = (log.botName || log.botCode || '').toLowerCase().includes(q);
        const matchType = log.type?.toLowerCase().includes(q);
        const matchGroup = log.groupName?.toLowerCase().includes(q);
        if (!matchSymbol && !matchMsg && !matchBot && !matchType && !matchGroup) return false;
      }

      return true;
    });
  }, [logs, selectedCategory, selectedGroup, searchTerm]);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `monorid-trade-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-4 backdrop-blur-md space-y-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-mono font-bold text-white tracking-wide">
                SYSTEM AUDIT & EXECUTION LOGS
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                {logs.length} REGISTERED EVENTS ({filteredLogs.length} DISPLAYED)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <Server className="w-2.5 h-2.5 text-cyan-400" />
                SERVER STORAGE: PERSISTENT
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Real-time audit trail for market scanning, opportunity detection, eliminated signals, trade execution, and TP/SL lifecycle.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search symbol, action, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={exportLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export</span>
            </button>
            <button
              onClick={onClearLogs}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/60 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
              title="Clear all logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Category Filter Chips (All, Trades, Signals, Scanner, System/Status) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            Category:
          </span>
          {[
            { id: 'ALL' as const, label: 'All', count: counts.all, icon: <Layers className="w-3 h-3" /> },
            { id: 'TRADES' as const, label: 'Trades', count: counts.trades, icon: <Zap className="w-3 h-3 text-cyan-400" /> },
            { id: 'SIGNALS' as const, label: 'Signals', count: counts.signals, icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" /> },
            { id: 'SCANNER' as const, label: 'Scanner', count: counts.scanner, icon: <Radio className="w-3 h-3 text-indigo-400" /> },
            { id: 'SYSTEM_STATUS' as const, label: 'System/Status', count: counts.system, icon: <Activity className="w-3 h-3 text-amber-400" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-cyan-950 border-cyan-400 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategory === tab.id ? 'bg-cyan-800 text-cyan-200' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Group Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-850/60">
          <span className="text-xs font-mono text-slate-400 mr-1">Group:</span>
          <button
            onClick={() => setSelectedGroup('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all border cursor-pointer ${
              selectedGroup === 'ALL'
                ? 'bg-cyan-950 border-cyan-400 text-white font-bold'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Groups
          </button>

          {ASSET_GROUPS.map((grp) => (
            <button
              key={grp.name}
              onClick={() => setSelectedGroup(grp.name)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all border cursor-pointer ${
                selectedGroup === grp.name
                  ? 'bg-cyan-950 border-cyan-400 text-white font-bold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {grp.name}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 overflow-hidden shadow-lg">
        <div className="overflow-x-auto max-h-[580px]">
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
                    No logs recorded matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let badgeColor = 'bg-slate-900 text-slate-400 border-slate-800';
                  let icon = <FileText className="w-3 h-3" />;
                  let actionLabel = log.type.replace(/_/g, ' ');

                  if (log.type === 'TRADE_EXECUTED' || log.type === 'ENTRY') {
                    badgeColor = log.side === 'LONG'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : 'bg-rose-950 text-rose-300 border-rose-600';
                    icon = <Zap className="w-3 h-3" />;
                    actionLabel = 'TRADE EXECUTED';
                  } else if (log.type === 'NEW_OPPORTUNITY') {
                    badgeColor = 'bg-emerald-950/90 text-emerald-300 border-emerald-500 font-bold';
                    icon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
                    actionLabel = 'NEW OPPORTUNITY';
                  } else if (log.type === 'ELIMINATED_OPPORTUNITY') {
                    badgeColor = 'bg-amber-950/70 text-amber-300 border-amber-700/80';
                    icon = <XCircle className="w-3 h-3 text-amber-400" />;
                    actionLabel = 'ELIMINATED';
                  } else if (log.type === 'TP_HIT' || log.type === 'TP1_HIT' || log.type === 'TP2_HIT' || log.type === 'TP3_HIT') {
                    badgeColor = 'bg-emerald-900/80 text-emerald-300 border-emerald-400 font-bold';
                    icon = <Target className="w-3 h-3 text-emerald-400" />;
                    actionLabel = 'TP 1:2 HIT';
                  } else if (log.type === 'SL_HIT') {
                    badgeColor = 'bg-rose-950 text-rose-300 border-rose-600 font-bold';
                    icon = <ShieldAlert className="w-3 h-3 text-rose-400" />;
                    actionLabel = 'SL HIT';
                  } else if (log.type === 'MARKET_SCAN') {
                    badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-600 font-semibold';
                    icon = <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />;
                    actionLabel = 'MARKET SCAN';
                  } else if (log.type === 'MONORID_RUNNING') {
                    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold';
                    icon = <Play className="w-3 h-3 text-emerald-400 fill-current" />;
                    actionLabel = 'MONORID RUNNING';
                  } else if (log.type === 'MONORID_STOP') {
                    badgeColor = 'bg-rose-950 text-rose-300 border-rose-600 font-bold';
                    icon = <Pause className="w-3 h-3 text-rose-400 fill-current" />;
                    actionLabel = 'MONORID STOP';
                  } else if (log.type === 'TELEGRAM_DISPATCH') {
                    badgeColor = 'bg-blue-950 text-blue-300 border-blue-700';
                    icon = <Send className="w-3 h-3 text-blue-400" />;
                    actionLabel = 'TELEGRAM';
                  } else if (log.type === 'TPSL') {
                    badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-600';
                    icon = <Target className="w-3 h-3 text-indigo-400" />;
                    actionLabel = 'TP/SL ENGINE';
                  } else if (log.type === 'SCAN_SIGNAL') {
                    badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-600/70';
                    icon = <ShieldAlert className="w-3 h-3 text-amber-400" />;
                    actionLabel = 'SIGNAL ALERT';
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                          {log.botName || log.botCode || 'Monorid Core'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-semibold whitespace-nowrap text-[11px]">
                        {log.groupName || 'Apex Cyber-Volatiles'}
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold whitespace-nowrap">
                        {log.symbol}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                          {icon}
                          <span>{actionLabel}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white whitespace-nowrap font-mono">
                        {log.price > 0 ? (
                          log.price < 0.0001
                            ? `$${log.price.toFixed(8)}`
                            : log.price < 0.01
                            ? `$${log.price.toFixed(6)}`
                            : log.price < 1
                            ? `$${log.price.toFixed(4)}`
                            : `$${log.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
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
                      <td className="py-2.5 px-3 text-slate-200 text-xs break-words leading-relaxed max-w-xl">
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
