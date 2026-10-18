'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Server, ShieldCheck, Wifi } from 'lucide-react';

interface SystemStatusCardProps {
  serverIp: string;
  isAutoTrading: boolean;
  isLiveMode: boolean;
  latencyMs: number;
}

export function SystemStatusCard({
  serverIp,
  isAutoTrading,
  isLiveMode,
  latencyMs,
}: SystemStatusCardProps) {
  const [copied, setCopied] = useState(false);

  const copyIp = () => {
    if (serverIp) {
      navigator.clipboard.writeText(serverIp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusItems = [
    { label: 'DATA FEED', status: 'ONLINE', ok: true },
    { label: 'EXECUTION', status: isAutoTrading ? 'ONLINE' : 'STANDBY', ok: isAutoTrading },
    { label: 'RISK CHECK', status: 'ONLINE', ok: true },
    { label: 'CONNECTIVITY', status: `${latencyMs}ms`, ok: true },
    { label: 'BACKUP SYSTEMS', status: 'ONLINE', ok: true },
  ];

  return (
    <div className="rounded-xl border border-cyan-950/70 bg-[#060a14]/90 p-3.5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            System Status
          </span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
          HEALTHY
        </span>
      </div>

      {/* Grid of statuses */}
      <div className="space-y-1.5 text-xs font-mono">
        {statusItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-900/40 border border-slate-850"
          >
            <div className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className={`w-3.5 h-3.5 ${item.ok ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-[11px]">{item.label}</span>
            </div>
            <span
              className={`text-[10px] font-bold ${
                item.ok ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>

      {/* Whitelist IP Helper */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <Server className="w-3 h-3 text-cyan-400" /> Server Whitelist IPv4:
          </span>
          <button
            onClick={copyIp}
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy IP</span>
              </>
            )}
          </button>
        </div>
        <div className="p-1.5 rounded bg-slate-950 font-mono text-center text-xs text-cyan-300 font-bold border border-cyan-900/50">
          {serverIp || 'Detecting server IP...'}
        </div>
      </div>
    </div>
  );
}
