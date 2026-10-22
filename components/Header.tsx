'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Play,
  Pause,
  AlertTriangle,
} from 'lucide-react';
import { MiroStyleLogo } from './MiroStyleLogo';

interface HeaderProps {
  activeTab: 'dashboard' | 'scanner' | 'positions' | 'logs' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'scanner' | 'positions' | 'logs' | 'settings') => void;
  isAutoTrading: boolean;
  setIsAutoTrading: React.Dispatch<React.SetStateAction<boolean>>;
  equity: number;
  availableBalance?: number | null;
  todayPnl: number;
  todayPnlPct?: number;
  openPositionsCount: number;
  onOpenSettings: () => void;
  onEmergencyFlatten: () => void;
  serverIp: string;
  onOpenGridBreakdown?: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  isAutoTrading,
  setIsAutoTrading,
  equity,
  availableBalance,
  todayPnl,
  todayPnlPct,
  openPositionsCount,
  onOpenSettings,
  onEmergencyFlatten,
  serverIp,
  onOpenGridBreakdown,
}: HeaderProps) {
  const [copiedIp, setCopiedIp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pnlPercent = todayPnlPct !== undefined ? todayPnlPct : 0;
  const isPnlPositive = todayPnl >= 0;

  const handleCopyIp = () => {
    if (serverIp && serverIp !== 'Detecting...') {
      // Try modern clipboard API first, fallback to execCommand if not focused
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(serverIp).catch(() => {
          // Fallback for when document is not focused
          const textArea = document.createElement('textarea');
          textArea.value = serverIp;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
          } catch (err) {
            console.warn('Copy failed:', err);
          }
          document.body.removeChild(textArea);
        });
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = serverIp;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.warn('Copy failed:', err);
        }
        document.body.removeChild(textArea);
      }
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  return (
    <header className="border-b border-cyan-950/70 bg-[#050914]/95 backdrop-blur-xl sticky top-0 z-40 px-3 sm:px-5 lg:px-7 py-3">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5">
        {/* Brand Zone: Miro-Style Motion Graphics Logo & Subtitle */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-4">
          <div className="flex items-center gap-3">
            <MiroStyleLogo
              size="md"
              animated={true}
              onClick={onOpenGridBreakdown}
            />

            {/* Typography & Badges */}
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="font-black tracking-[0.14em] text-white text-lg leading-tight font-sans">
                  MONORID
                </h1>

                <span className="font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-500/40 rounded text-[10px] px-2 py-0.5 tracking-wide shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                  FUTURES v2.4
                </span>

                <span className="font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 rounded text-[10px] px-2 py-0.5 tracking-wide flex items-center gap-1.5 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  24/7 AUTO
                </span>
              </div>

              <div className="font-mono text-slate-400 text-[10px] tracking-tight mt-0.5 flex items-center flex-wrap gap-1.5">
                <span className="text-slate-300">Trading Lifestyle Quant</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-semibold">MEXC 1M</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  IP: <span className="font-semibold text-slate-200">{serverIp}</span>
                   
                    <button
                      onClick={handleCopyIp}
                      title="Copy IP"
                      className="ml-0.5 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {copiedIp ? '✓' : '⧉'}
                    </button>

                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Smooth horizontal scrolling) */}
          <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all ${
                activeTab === 'scanner'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Scanner (75)
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all relative ${
                activeTab === 'positions'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Positions
              {openPositionsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-[10px] text-slate-950 font-black shadow-[0_0_8px_#10b981]">
                  {openPositionsCount} Active
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Logs
            </button>
          </nav>
        </div>

        {/* Dashboard Top Right Management Zone: Equity, P&L, Execution Modes & Switches */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between sm:justify-end">
          {/* Equity & Daily P&L widget */}
          <div 
            suppressHydrationWarning
            className="bg-slate-900/80 border border-slate-800/90 rounded-xl px-3.5 py-1.5 flex items-center gap-4 text-xs font-mono shadow-inner"
          >
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-medium">Equity (USDT)</span>
              <div className="flex items-center gap-2">
                <span 
                  suppressHydrationWarning
                  className="text-white font-black text-sm tracking-wide"
                >
                  ${mounted ? equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
                {mounted && ((availableBalance !== undefined && availableBalance !== null && availableBalance < 0.70) || ((availableBalance === undefined || availableBalance === null) && equity > 0 && equity < 0.70)) && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold uppercase tracking-wider">
                    &lt; $0.70 Blocked
                  </span>
                )}
              </div>
            </div>
            <div className="border-l border-slate-800 pl-3.5">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-medium">Today&apos;s P&L</span>
              <span 
                suppressHydrationWarning
                className={`font-black text-sm flex items-center gap-1 ${!mounted ? 'text-slate-400' : isPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {mounted ? (
                  <>
                    {isPnlPositive ? '+' : ''}${todayPnl.toFixed(2)}
                    <span className="text-[11px] font-semibold" suppressHydrationWarning>
                      ({isPnlPositive ? '+' : ''}{pnlPercent.toFixed(2)}%)
                    </span>
                  </>
                ) : (
                  <>
                    $0.00
                    <span className="text-[11px] font-semibold" suppressHydrationWarning>
                      (0.00%)
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Master 24/7 Automation Switch */}
          <button
            onClick={() => setIsAutoTrading((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-black tracking-wide transition-all ${
              isAutoTrading
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg glow-emerald hover:brightness-110 cursor-pointer'
                : 'bg-rose-950/90 text-rose-300 border border-rose-800/80 hover:bg-rose-900/80 cursor-pointer'
            }`}
          >
            {isAutoTrading ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>BOT ACTIVE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>RESUME BOT</span>
              </>
            )}
          </button>

          {/* Emergency Panic Close */}
          {openPositionsCount > 0 && (
            <button
              onClick={onEmergencyFlatten}
              title="Close all open futures positions immediately"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-rose-600/20 text-rose-400 border border-rose-500/50 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Panic Close</span>
            </button>
          )}

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors cursor-pointer"
            title="Settings, Whitelist IP & API Keys"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
