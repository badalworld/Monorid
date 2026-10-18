'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Compass, Sparkles } from 'lucide-react';

interface MonoridLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  showBadges?: boolean;
  showBreakdownBadge?: boolean;
  animated?: boolean;
  className?: string;
  serverIp?: string;
  onCopyIp?: () => void;
  copiedIp?: boolean;
  onOpenGridBreakdown?: () => void;
}

export function MonoridLogo({
  size = 'md',
  showText = true,
  showSubtitle = true,
  showBadges = true,
  showBreakdownBadge = true,
  animated = true,
  className = '',
  serverIp = '34.96.48.38',
  onCopyIp,
  copiedIp = false,
  onOpenGridBreakdown,
}: MonoridLogoProps) {
  // Dimensions per size variant
  const dimensions = {
    sm: {
      box: 38,
      iconSize: 26,
      textSize: 'text-base',
      badgeText: 'text-[9px] px-1.5 py-0.5',
      subSize: 'text-[9px]',
      dotSize: 'w-2 h-2',
      dotOffset: '-top-0.5 -right-0.5',
      radius: 'rounded-xl',
    },
    md: {
      box: 46,
      iconSize: 32,
      textSize: 'text-lg',
      badgeText: 'text-[10px] px-2 py-0.5',
      subSize: 'text-[10px]',
      dotSize: 'w-2.5 h-2.5',
      dotOffset: '-top-1 -right-1',
      radius: 'rounded-2xl',
    },
    lg: {
      box: 58,
      iconSize: 40,
      textSize: 'text-xl',
      badgeText: 'text-xs px-2.5 py-1',
      subSize: 'text-xs',
      dotSize: 'w-3 h-3',
      dotOffset: '-top-1 -right-1',
      radius: 'rounded-2xl',
    },
    xl: {
      box: 74,
      iconSize: 52,
      textSize: 'text-2xl',
      badgeText: 'text-xs px-3 py-1',
      subSize: 'text-sm',
      dotSize: 'w-3.5 h-3.5',
      dotOffset: '-top-1.5 -right-1.5',
      radius: 'rounded-3xl',
    },
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none group ${className}`}>
      {/* Authentic Monorid Squircle Emblem with Miro Grid Breakdown Motion */}
      <div
        onClick={onOpenGridBreakdown}
        title={onOpenGridBreakdown ? 'Click to inspect Logo Motion Graphics Grid Breakdown' : undefined}
        className={`relative flex items-center justify-center shrink-0 ${
          onOpenGridBreakdown ? 'cursor-pointer' : ''
        }`}
        style={{ width: dimensions.box, height: dimensions.box }}
      >
        {/* Ambient Neon Breathing Aura */}
        {animated && (
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.35, 0.7, 0.35],
            }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-[-4px] rounded-2xl bg-cyan-500/30 blur-md pointer-events-none"
          />
        )}

        {/* Precision Squircle Container with Subtle Blueprint Coordinate Accents */}
        <div
          className={`relative flex items-center justify-center w-full h-full ${dimensions.radius} bg-gradient-to-b from-[#091e2e] via-[#05131f] to-[#020a12] border border-cyan-500/50 shadow-[0_0_18px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all duration-300 group-hover:border-cyan-400 group-hover:shadow-[0_0_26px_rgba(6,182,212,0.5)] overflow-hidden`}
        >
          {/* Subtle Blueprint Grid Lines inside Squircle (Miro Grid aesthetic) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25 group-hover:opacity-40 transition-opacity"
            style={{
              backgroundImage:
                'linear-gradient(rgba(6,182,212,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.2) 1px, transparent 1px)',
              backgroundSize: '10px 10px',
            }}
          />

          {/* Electric Bolt & Miro Grid Breakdown Vector */}
          <svg
            width={dimensions.iconSize}
            height={dimensions.iconSize}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible relative z-10"
          >
            <defs>
              {/* Electric Surge Gradient along the path */}
              <linearGradient id="headerSurgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.2" />
              </linearGradient>

              {/* Electric Neon Glow Filter */}
              <filter id="headerNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Miro Construction Guides: Concentric Compass Circles */}
            <circle
              cx="50"
              cy="50"
              r="38"
              stroke="#06b6d4"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.3"
            />
            <circle
              cx="50"
              cy="50"
              r="22"
              stroke="#0284c7"
              strokeWidth="0.6"
              strokeDasharray="1.5 2"
              opacity="0.3"
            />

            {/* 45° Diagonal Ray Guide */}
            <line
              x1="15"
              y1="85"
              x2="85"
              y2="15"
              stroke="#0284c7"
              strokeWidth="0.6"
              strokeDasharray="2 2"
              opacity="0.35"
            />

            {/* Base Path - Exact Pixel Traced Hollow Outline */}
            <path
              d="M 53.6 21.2 L 24.8 53.6 L 50.0 53.6 L 46.4 78.8 L 75.2 46.4 L 50.0 46.4 Z"
              fill="rgba(6, 182, 212, 0.08)"
              stroke="#0369a1"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />

            {/* Sharp Cyan Core Stroke matching user's uploaded logo full match */}
            <path
              d="M 53.6 21.2 L 24.8 53.6 L 50.0 53.6 L 46.4 78.8 L 75.2 46.4 L 50.0 46.4 Z"
              fill="none"
              stroke="#00f2fe"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#headerNeonGlow)"
            />

            {/* Dynamic Electric Surge Pulse (Traveling electricity along the exact contour) */}
            {animated && (
              <motion.path
                d="M 53.6 21.2 L 24.8 53.6 L 50.0 53.6 L 46.4 78.8 L 75.2 46.4 L 50.0 46.4 Z"
                fill="none"
                stroke="url(#headerSurgeGrad)"
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60 180"
                animate={{
                  strokeDashoffset: [240, 0],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            )}

            {/* Vertex Crosshair Nodes (P1, P2, P4, P5) */}
            <circle cx="53.6" cy="21.2" r="2.2" fill="#00f2fe" opacity="0.9" />
            <circle cx="24.8" cy="53.6" r="2.2" fill="#00f2fe" opacity="0.9" />
            <circle cx="46.4" cy="78.8" r="2.2" fill="#00f2fe" opacity="0.9" />
            <circle cx="75.2" cy="46.4" r="2.2" fill="#00f2fe" opacity="0.9" />
          </svg>
        </div>

        {/* Top-Right 24/7 Quantum Connectivity Beacon Node */}
        <div
          className={`absolute ${dimensions.dotOffset} ${dimensions.dotSize} rounded-full bg-[#00f2fe] border-2 border-[#030712] shadow-[0_0_8px_#00f2fe] z-20 pointer-events-none`}
        >
          {animated && (
            <motion.span
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.7, 0, 0.7],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute inset-0 rounded-full bg-[#00f2fe] pointer-events-none"
            />
          )}
        </div>
      </div>

      {/* Typography & High-Status Badges */}
      {showText && (
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            {/* MONORID Title */}
            <div
              onClick={onOpenGridBreakdown}
              className={`flex items-center gap-1.5 ${
                onOpenGridBreakdown ? 'cursor-pointer group/title' : ''
              }`}
            >
              <h1
                className={`font-black tracking-[0.14em] text-white ${dimensions.textSize} leading-tight font-sans transition-colors group-hover/title:text-cyan-300 flex items-center`}
              >
                MONORID
              </h1>
            </div>

            {/* Badges - EXACT MATCH TO USER'S UPLOADED SCREENSHOT */}
            {showBadges && (
              <>
                <span
                  className={`font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-500/40 rounded ${dimensions.badgeText} tracking-wide shadow-[0_0_8px_rgba(6,182,212,0.15)]`}
                >
                  FUTURES v2.4
                </span>

                <span
                  className={`font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 rounded ${dimensions.badgeText} tracking-wide flex items-center gap-1.5 shadow-[0_0_8px_rgba(16,185,129,0.15)]`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  24/7 AUTO
                </span>
              </>
            )}
          </div>

          {/* Subtitle / Quant Lineage */}
          {showSubtitle && (
            <div
              className={`font-mono text-slate-400 ${dimensions.subSize} tracking-tight mt-0.5 flex items-center flex-wrap gap-1.5`}
            >
              <span className="text-slate-300">Trading Lifestyle Quant</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-semibold">MEXC 5M</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-300">
                IP: <span className="font-semibold text-slate-200">{serverIp}</span>
                {onCopyIp && (
                  <button
                    onClick={onCopyIp}
                    title="Copy IP"
                    className="ml-0.5 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    {copiedIp ? '✓' : '⧉'}
                  </button>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
