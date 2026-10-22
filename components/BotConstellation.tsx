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
}: BotConstellationProps) {
  const activeBots = bots.filter((b) => b.status === 'HOLDING' && b.currentSymbol);
  const count = Math.max(activeBots.length, 1);
  const angles = Array.from({ length: count }, (_, i) => 270 + (360 / count) * i);

  return (
    <div className="relative w-full max-w-3xl mx-auto h-[510px] sm:h-[530px] flex items-center justify-center overflow-hidden rounded-2xl border border-cyan-950/70 bg-gradient-to-b from-[#081022]/90 via-[#060a16]/95 to-[#04060d] p-4 cyber-grid">
      {/* Background radial glow */}
      <div className="absolute inset-0 radial-glow pointer-events-none"></div>

      {/* Cybernetic orbit rings */}
      <div className="absolute w-[370px] h-[370px] sm:w-[410px] sm:h-[410px] rounded-full border border-cyan-500/15 pointer-events-none animate-[spin_120s_linear_infinite]"></div>
      <div className="absolute w-[250px] h-[250px] sm:w-[270px] sm:h-[270px] rounded-full border border-cyan-400/20 border-dashed pointer-events-none"></div>
      <div className="absolute w-[150px] h-[150px] rounded-full border border-cyan-300/30 pointer-events-none glow-cyan"></div>

      {/* SVG Connecting Conduits with animated pulses */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 700 520">
        <defs>
          <linearGradient id="conduitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
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
          const cx = 350;
          const cy = 260;
          const r = 190;
          const x = cx + r * Math.cos(rad);
          const y = cy + r * Math.sin(rad);

          return (
            <g key={`conduit-${i}`}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="url(#conduitGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              {isAutoTrading && (
                <circle r="2.5" fill="#22d3ee" filter="url(#conduitGlow)">
                  <animate
                    attributeName="cx"
                    from={cx}
                    to={x}
                    dur={`${2.0 + (i % 3) * 0.4}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    from={cy}
                    to={y}
                    dur={`${2.0 + (i % 3) * 0.4}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur={`${2.0 + (i % 3) * 0.4}s`}
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
          animate={{ scale: [1, 1.025, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <MiroStyleLogo
            size="lg"
            animated={true}
            onClick={onOpenLiveTrades}
          />

          {/* Label below logo */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center text-center whitespace-nowrap">
            <span className="text-xs font-black tracking-widest text-cyan-300 font-mono">
              MONORID
            </span>
            <span className="text-[8px] font-bold tracking-widest text-slate-200 font-mono uppercase">
              FULL AUTOMATION
            </span>
            <div className="mt-1 flex items-center gap-1 text-[8.5px] font-mono text-emerald-400 bg-emerald-950/90 px-2.5 py-0.5 rounded border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
              <span>{openPositionsCount} ACTIVE</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Active Orbital Units — only bots with open positions */}
      {activeBots.map((bot, index) => {
        const deg = angles[index % angles.length];
        const rad = (deg * Math.PI) / 180;
        const radiusPx = 190;
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
              className={`flex flex-col items-center p-2 rounded-xl backdrop-blur-md transition-all border ${
                isSelected
                  ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)]'
                  : isHolding
                  ? 'bg-[#09152a]/90 border-emerald-500/60 shadow-[0_0_14px_rgba(16,185,129,0.3)]'
                  : 'bg-[#081020]/85 border-cyan-800/40 hover:border-cyan-400/70 hover:bg-[#0c1830]'
              }`}
            >
              {/* Bot Strategy Icon Avatar */}
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-b from-cyan-950 to-slate-900 border border-cyan-500/50 shadow-inner">
                {icon}
                <span
                  className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                    isHolding ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-500'
                  }`}
                ></span>
              </div>

              {/* Exact Strategy / Bot Name (NO 'BOT 01', 'BOT 02', only "Apex Momentum", "Mean Reversion", etc.) */}
              <span
                className="mt-1 text-[9.5px] font-mono font-bold text-white max-w-[105px] text-center leading-tight truncate px-0.5"
                title={cleanName}
              >
                {cleanName}
              </span>

              {/* Status Badge: Holding Symbol vs Scanning */}
              <div className="mt-1 flex items-center gap-1">
                {isHolding ? (
                  <span className="text-[7.5px] px-1 py-0.2 rounded font-mono bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold truncate max-w-[70px]">
                    {bot.currentSymbol?.replace('_USDT', '')}
                  </span>
                ) : (
                  <span className="text-[7.5px] px-1 py-0.2 rounded font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    SCANNING
                  </span>
                )}
                <span className="text-[8px] font-mono font-bold text-emerald-400">
                  +{bot.pnl.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
