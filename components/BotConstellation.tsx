'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Activity,
  Target,
  Zap,
  Shield,
  BarChart3,
  Layers,
  Cpu,
  Radio,
  Sparkles,
} from 'lucide-react';
import { MiroStyleLogo } from './MiroStyleLogo';

export interface BotUnit {
  id: string;
  code: string;
  name: string;
  strategy: string;
  pnl: number;
  status: 'ACTIVE' | 'SCANNING' | 'HOLDING';
  assignedGroup: string;
  currentSymbol?: string;
  activeSignalsCount: number;
  tradesCount?: number;
}

interface BotConstellationProps {
  bots: BotUnit[];
  activeBotId: string | null;
  onSelectBot: (botId: string | null) => void;
  isAutoTrading: boolean;
  totalPnl: number;
  openPositionsCount: number;
  onOpenLiveTrades: () => void;
  onOpenBotWork: (botId: string) => void;
  scanSpeedMs?: number;
}

// Custom icons mapping per strategy
const STRATEGY_ICONS: Record<string, React.ReactNode> = {
  'Apex Momentum': <TrendingUp className="w-4 h-4 text-cyan-300" />,
  'Mean Reversion': <Activity className="w-4 h-4 text-emerald-300" />,
  'Breakout Hunter': <Target className="w-4 h-4 text-amber-300" />,
  'Rapid Scalper': <Zap className="w-4 h-4 text-cyan-300" />,
  'Swing Raider': <Shield className="w-4 h-4 text-indigo-300" />,
  'Volatility Reaper': <BarChart3 className="w-4 h-4 text-rose-300" />,
  'Liquidity Sweeper': <Layers className="w-4 h-4 text-teal-300" />,
  'Order Flow Reaper': <Cpu className="w-4 h-4 text-blue-300" />,
};

export function BotConstellation({
  bots,
  activeBotId,
  onSelectBot,
  isAutoTrading,
  totalPnl,
  openPositionsCount,
  onOpenLiveTrades,
  onOpenBotWork,
  scanSpeedMs,
}: BotConstellationProps) {
  // Always render ALL bots in the constellation so the entire fleet is visible and animated
  const displayBots = bots && bots.length > 0 ? bots : [];
  const count = Math.max(displayBots.length, 8);
  const angles = Array.from({ length: count }, (_, i) => 270 + (360 / count) * i);

  return (
    <div className="relative w-full max-w-4xl mx-auto h-[530px] sm:h-[560px] flex items-center justify-center overflow-hidden rounded-2xl border border-cyan-950/70 bg-gradient-to-b from-[#081022]/90 via-[#060a16]/95 to-[#04060d] p-4 cyber-grid shadow-[0_0_50px_rgba(6,182,212,0.08)]">
      {/* Background radial glow */}
      <div className="absolute inset-0 radial-glow pointer-events-none"></div>

      {/* Cybernetic ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-1/4 left-1/5 w-1 h-1 bg-cyan-400 rounded-full animate-ping"></div>
        <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 left-1/3 w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
      </div>

      {/* Cybernetic orbit rings */}
      <div className="absolute w-[440px] h-[440px] sm:w-[460px] sm:h-[460px] rounded-full border border-cyan-500/10 pointer-events-none animate-[spin_180s_linear_infinite]"></div>
      <div className="absolute w-[360px] h-[360px] sm:w-[380px] sm:h-[380px] rounded-full border border-cyan-400/20 border-dashed pointer-events-none animate-[spin_90s_linear_infinite_reverse]"></div>
      <div className="absolute w-[240px] h-[240px] rounded-full border border-cyan-300/25 pointer-events-none glow-cyan"></div>
      <div className="absolute w-[160px] h-[160px] rounded-full border border-cyan-400/30 border-dotted pointer-events-none"></div>

      {/* Rotating Radar Sweep when Auto Trading is active */}
      {isAutoTrading && (
        <div className="absolute w-[420px] h-[420px] rounded-full pointer-events-none overflow-hidden animate-[spin_6s_linear_infinite]">
          <div className="w-1/2 h-1/2 origin-bottom-right bg-gradient-to-br from-cyan-500/25 via-cyan-500/5 to-transparent [clip-path:polygon(0_0,100%_100%,0_100%)]"></div>
        </div>
      )}

      {/* SVG Connecting Conduits with animated pulses */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 760 560">
        <defs>
          <linearGradient id="conduitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="holdingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
          </linearGradient>
          <filter id="conduitGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {angles.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const cx = 380;
          const cy = 280;
          const r = 200;
          const x = cx + r * Math.cos(rad);
          const y = cy + r * Math.sin(rad);
          const bot = displayBots[i];
          const isHolding = bot?.status === 'HOLDING' && bot?.currentSymbol;

          return (
            <g key={`conduit-${i}`}>
              {/* Static conduit line */}
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={isHolding ? 'url(#holdingGrad)' : 'url(#conduitGrad)'}
                strokeWidth={isHolding ? '2.0' : '1.2'}
                strokeDasharray={isHolding ? 'none' : '4 4'}
                opacity={isHolding ? '0.85' : '0.45'}
              />

              {/* Animated energy pulse moving from center to bot */}
              {isAutoTrading && (
                <circle
                  r={isHolding ? '3.5' : '2.5'}
                  fill={isHolding ? '#34d399' : '#22d3ee'}
                  filter="url(#conduitGlow)"
                >
                  <animate
                    attributeName="cx"
                    from={cx}
                    to={x}
                    dur={`${1.8 + (i % 4) * 0.3}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    from={cy}
                    to={y}
                    dur={`${1.8 + (i % 4) * 0.3}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur={`${1.8 + (i % 4) * 0.3}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Central Core: MONORID CORE with Miro-Style Motion Graphics */}
      <div className="relative z-20 flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative cursor-pointer"
          onClick={onOpenLiveTrades}
        >
          <MiroStyleLogo
            size="lg"
            animated={true}
            onClick={onOpenLiveTrades}
          />

          {/* Label below logo */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center text-center whitespace-nowrap pointer-events-none">
            <span className="text-xs font-black tracking-widest text-cyan-300 font-mono drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
              MONORID QUANT
            </span>
            <span className="text-[8px] font-bold tracking-widest text-slate-300 font-mono uppercase flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              FLEET ONLINE (8/8)
            </span>
            <div className="mt-1 flex items-center gap-1 text-[8.5px] font-mono text-emerald-400 bg-emerald-950/90 px-2.5 py-0.5 rounded border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <span>{openPositionsCount} IN POSITION</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300">
                {scanSpeedMs ? `${(scanSpeedMs / 1000).toFixed(1)}s CYCLE` : '1M SCAN'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* All 8 Orbital Bot Units — Full Fleet Visibility with Active Cybernetic Animations */}
      {displayBots.map((bot, index) => {
        const deg = angles[index % angles.length];
        const rad = (deg * Math.PI) / 180;
        const radiusPx = 195;
        const xOffset = radiusPx * Math.cos(rad);
        const yOffset = radiusPx * Math.sin(rad);
        const isSelected = activeBotId === bot.id;
        const isHolding = bot.status === 'HOLDING' && bot.currentSymbol;
        const cleanName = bot.name.replace('Monorid ', '');
        const icon = STRATEGY_ICONS[cleanName] || <Activity className="w-4 h-4 text-cyan-300" />;

        return (
          <div
            key={bot.id}
            style={{
              transform: `translate(${xOffset}px, ${yOffset}px)`,
            }}
            onClick={() => {
              onSelectBot(bot.id);
              onOpenBotWork(bot.id);
            }}
            className={`absolute z-30 cursor-pointer transition-all duration-300 group ${
              isSelected ? 'scale-110 z-40' : 'hover:scale-105'
            }`}
          >
            <div
              className={`flex flex-col items-center p-2 rounded-xl backdrop-blur-md transition-all border relative overflow-hidden ${
                isSelected
                  ? 'bg-cyan-950/95 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.7)]'
                  : isHolding
                  ? 'bg-[#09182d]/95 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/30'
                  : 'bg-[#081020]/90 border-cyan-900/50 hover:border-cyan-400/70 hover:bg-[#0c1830] shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              }`}
            >
              {/* Subtle top scanner sweep bar across each bot card */}
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] ${
                  isHolding
                    ? 'bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 animate-pulse'
                    : isAutoTrading
                    ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[shimmer_2s_infinite]'
                    : 'bg-cyan-900/40'
                }`}
              ></div>

              {/* Bot Strategy Icon Avatar with Animated Ring */}
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-b from-cyan-950 to-slate-900 border transition-all ${
                  isHolding
                    ? 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'border-cyan-500/50 shadow-inner'
                }`}
              >
                {icon}
                {/* Status Beacon Indicator */}
                <span
                  className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                    isHolding
                      ? 'bg-emerald-400 animate-ping'
                      : isAutoTrading
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-slate-500'
                  }`}
                ></span>
                <span
                  className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                    isHolding
                      ? 'bg-emerald-400'
                      : isAutoTrading
                      ? 'bg-cyan-400'
                      : 'bg-slate-500'
                  }`}
                ></span>
              </div>

              {/* Bot Name */}
              <span
                className="mt-1 text-[9.5px] font-mono font-bold text-white max-w-[108px] text-center leading-tight truncate px-0.5"
                title={cleanName}
              >
                {cleanName}
              </span>

              {/* Status Badge: Active Position vs Scanning */}
              <div className="mt-1 flex items-center gap-1">
                {isHolding ? (
                  <span className="text-[7.5px] px-1.5 py-0.5 rounded font-mono bg-emerald-950/90 text-emerald-300 border border-emerald-500 font-bold truncate max-w-[72px] flex items-center gap-0.5 shadow-sm">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                    {bot.currentSymbol?.replace('_USDT', '')}
                  </span>
                ) : (
                  <span className="text-[7.5px] px-1.5 py-0.5 rounded font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 flex items-center gap-0.5">
                    <Radio className="w-2 h-2 text-cyan-400 animate-pulse" />
                    SCAN 1M
                  </span>
                )}
                <span
                  className={`text-[8px] font-mono font-bold ${
                    bot.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {bot.pnl >= 0 ? `+${bot.pnl.toFixed(1)}%` : `${bot.pnl.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Bottom Live System Telemetry Bar */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[8px] font-mono text-cyan-400/70 border-t border-cyan-950/60 pt-1 pointer-events-none">
        <span className="flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
          MONORID MULTI-AGENT SWARM
        </span>
        <span className="text-slate-400">
          ALL 8 UNITS SYNCED • DUAL-WAVE MOMENTUM • 200 EMA MACRO
        </span>
        <span className="text-emerald-400">
          {isAutoTrading ? '● AUTONOMOUS EXECUTION ENGAGED' : '○ STANDBY'}
        </span>
      </div>
    </div>
  );
}
