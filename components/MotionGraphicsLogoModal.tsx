'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Play,
  Pause,
  Sparkles,
  Layers,
  Compass,
  TrendingUp,
} from 'lucide-react';

interface MotionGraphicsLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MotionGraphicsLogoModal({ isOpen, onClose }: MotionGraphicsLogoModalProps) {
  // Playback & Animation Phase: 'loop' | 'grid' | 'trace' | 'kinetic' | 'solid'
  const [activePhase, setActivePhase] = useState<'loop' | 'grid' | 'trace' | 'kinetic' | 'solid'>('loop');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5, 1, 1.5

  // Layer Visibility Toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCompassCircles, setShowCompassCircles] = useState<boolean>(true);
  const [showAngleGuides, setShowAngleGuides] = useState<boolean>(true);
  const [showVertices, setShowVertices] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showSolidEmblem, setShowSolidEmblem] = useState<boolean>(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Key geometric points of the Monorid logo (M shape + candlesticks)
  const vertices = [
    { id: 'P1', x: 30, y: 35, tagX: 5, tagY: 28, label: 'M Left Peak', angle: '45.0°' },
    { id: 'P2', x: 50, y: 55, tagX: 52, tagY: 62, label: 'M Center Valley', angle: '0.0°' },
    { id: 'P3', x: 70, y: 35, tagX: 75, tagY: 28, label: 'M Right Peak', angle: '135.0°' },
    { id: 'P4', x: 75, y: 25, tagX: 80, tagY: 18, label: 'Candle 1 Top', angle: '90.0°' },
    { id: 'P5', x: 82, y: 20, tagX: 87, tagY: 13, label: 'Candle 2 Top', angle: '90.0°' },
    { id: 'P6', x: 89, y: 15, tagX: 94, tagY: 8, label: 'Candle 3 Top', angle: '90.0°' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative w-full max-w-5xl bg-[#030712] border border-cyan-500/40 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden my-auto max-h-[95vh]"
      >
          {/* Top Title Bar with Quant Blueprint Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-[#050e1c]/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <Compass className="w-5 h-5 text-cyan-300 animate-spin" style={{ animationDuration: '18s' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-widest text-white font-mono">
                    MONORID // LOGO MOTION GRAPHICS
                  </h2>
                  <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/90 border border-cyan-500/50 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                    GRID BREAKDOWN
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400">
                  Architectural breakdown & kinetic motion choreography • Ref: Miro Grid System (Dribbble 26724063)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-400 hover:text-cyan-300 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Main Stage: Blueprint Viewport + Interactive Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 overflow-hidden">
            {/* Viewport Canvas (Left 8 Cols) */}
            <div className="lg:col-span-8 relative min-h-[380px] sm:min-h-[460px] bg-[#02050e] flex items-center justify-center p-6 border-b lg:border-b-0 lg:border-r border-cyan-950/60 overflow-hidden select-none">
              {/* Subtle Ambient Vignette & Blueprint Matrix */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.15) 0%, transparent 70%), linear-gradient(rgba(6,182,212,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.08) 1px, transparent 1px)',
                  backgroundSize: '100% 100%, 24px 24px, 24px 24px',
                }}
              />

              {/* Viewport Dimension Scale Overlay */}
              <div className="absolute top-3 left-4 font-mono text-[10px] text-cyan-500/60 flex items-center gap-2 pointer-events-none">
                <span className="inline-block w-2 h-2 border-t border-l border-cyan-400"></span>
                <span>ORIGIN: [50, 50] • SCALE: 4.8X • VIEWBOX: 100×100</span>
              </div>

              <div className="absolute top-3 right-4 font-mono text-[10px] text-cyan-400/80 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded pointer-events-none flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span>STATE: {activePhase.toUpperCase()}</span>
              </div>

              {/* Center Vector Motion Graphics Stage (Large crisp vector stage) */}
              <div className="relative w-80 h-80 sm:w-96 sm:h-96 md:w-[440px] md:h-[440px] flex items-center justify-center">
                {/* Logo Image Base */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <motion.img
                    src="/monorid-logo-full.png"
                    alt="Monorid Logo"
                    className="w-full h-full object-contain"
                    style={{ objectPosition: 'center 30%' }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                  />
                </div>

                <svg
                  viewBox="-22 -22 144 144"
                  className="w-full h-full overflow-visible drop-shadow-[0_0_35px_rgba(6,182,212,0.35)] relative z-10"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    {/* Primary Electric Neon Linear Gradient */}
                    <linearGradient id="gridBreakdownNeon" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00f2fe" />
                      <stop offset="50%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>

                    {/* Secondary Ribbon Gradient for Miro Harmonic Waves */}
                    <linearGradient id="miroRibbon1" x1="20%" y1="0%" x2="80%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
                    </linearGradient>

                    <linearGradient id="laserPulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="60%" stopColor="#00f2fe" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                    </linearGradient>

                    {/* Volumetric Neon Glow */}
                    <filter id="vectorNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="blur1" />
                      <feGaussianBlur stdDeviation="10" result="blur2" />
                      <feMerge>
                        <feMergeNode in="blur2" />
                        <feMergeNode in="blur1" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* LAYER 1: CARTESIAN PRECISION GRID */}
                  {showGrid && (
                    <g className="transition-opacity duration-300" opacity={0.35}>
                      {/* Sub-grid lines every 10 units */}
                      {[-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map((val) => (
                        <React.Fragment key={`grid-${val}`}>
                          <line
                            x1={val}
                            y1="-25"
                            x2={val}
                            y2="125"
                            stroke="#0ea5e9"
                            strokeWidth="0.5"
                            strokeDasharray={val === 50 ? 'none' : '1.5 2'}
                            strokeOpacity={val === 50 ? 0.9 : 0.35}
                          />
                          <line
                            x1="-25"
                            y1={val}
                            x2="125"
                            y2={val}
                            stroke="#0ea5e9"
                            strokeWidth="0.5"
                            strokeDasharray={val === 50 ? 'none' : '1.5 2'}
                            strokeOpacity={val === 50 ? 0.9 : 0.35}
                          />
                        </React.Fragment>
                      ))}

                      {/* Major Center Origin Crosshair */}
                      <circle cx="50" cy="50" r="1.5" fill="#38bdf8" />
                      <circle cx="50" cy="50" r="4" stroke="#38bdf8" strokeWidth="0.75" fill="none" />
                    </g>
                  )}

                  {/* LAYER 2: COMPASS CONCENTRIC CONSTRUCTION CIRCLES (Miro Grid Breakdown Style) */}
                  {showCompassCircles && (
                    <g className="transition-opacity duration-300" opacity={0.5}>
                      {/* Outer boundary tangent circle R=48 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="48"
                        stroke="#06b6d4"
                        strokeWidth="0.8"
                        strokeDasharray="3 3"
                        fill="none"
                      />
                      {/* Mid radius circle R=36 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="36"
                        stroke="#0ea5e9"
                        strokeWidth="0.7"
                        strokeDasharray="2 3"
                        fill="none"
                      />
                      {/* Core radius circle R=24 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="24"
                        stroke="#38bdf8"
                        strokeWidth="0.9"
                        strokeDasharray="4 2"
                        fill="none"
                      />
                      {/* Inner pivot circle R=12 */}
                      <circle
                        cx="50"
                        cy="50"
                        r="12"
                        stroke="#38bdf8"
                        strokeWidth="0.6"
                        strokeDasharray="2 2"
                        fill="none"
                      />

                      {/* Vertex local tangent arcs (Compass Breakdown) */}
                      <circle cx="30" cy="35" r="10" stroke="#00f2fe" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
                      <circle cx="50" cy="55" r="10" stroke="#00f2fe" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
                      <circle cx="70" cy="35" r="10" stroke="#00f2fe" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
                      <circle cx="75" cy="25" r="10" stroke="#00f2fe" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
                      <circle cx="82" cy="20" r="10" stroke="#00f2fe" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
                      <circle cx="89" cy="15" r="10" stroke="#00f2fe" strokeWidth="0.6" strokeDasharray="1.5 1.5" fill="none" />
                    </g>
                  )}

                  {/* LAYER 3: 45° AND 63.4° ANGLE GUIDES & RAYS */}
                  {showAngleGuides && (
                    <g className="transition-opacity duration-300" opacity={0.65}>
                      {/* 45° Diagonal Ray passing through Origin */}
                      <line
                        x1="-10"
                        y1="110"
                        x2="110"
                        y2="-10"
                        stroke="#0284c7"
                        strokeWidth="0.75"
                        strokeDasharray="4 2"
                      />
                      {/* M Shape Connection Lines */}
                      <line
                        x1="30"
                        y1="35"
                        x2="50"
                        y2="55"
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="50"
                        y1="55"
                        x2="70"
                        y2="35"
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                      />
                      {/* Candlestick Vertical Guides */}
                      <line
                        x1="75"
                        y1="25"
                        x2="75"
                        y2="55"
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="82"
                        y1="20"
                        x2="82"
                        y2="55"
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="89"
                        y1="15"
                        x2="89"
                        y2="55"
                        stroke="#38bdf8"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                      />

                      {/* Horizontal Base Alignment Guide */}
                      <line x1="-15" y1="55" x2="115" y2="55" stroke="#0284c7" strokeWidth="0.6" strokeDasharray="2 3" opacity={0.5} />

                      {/* Angle arc callout at M Left Peak */}
                      <path d="M 30 43 A 8 8 0 0 1 38 39" fill="none" stroke="#22d3ee" strokeWidth="0.8" />
                      <text x="30" y="37" fill="#38bdf8" fontSize="4.5" fontFamily="monospace">
                        θ=45°
                      </text>
                    </g>
                  )}

                  {/* LAYER 4: OUTER SQUIRCLE BOUNDARY & DIMENSION CALIPERS */}
                  {showDimensions && (
                    <g className="transition-opacity duration-300">
                      {/* Dimension caliper: Width 100 */}
                      <line x1="0" y1="-8" x2="100" y2="-8" stroke="#38bdf8" strokeWidth="0.7" />
                      <line x1="0" y1="-11" x2="0" y2="-5" stroke="#38bdf8" strokeWidth="0.7" />
                      <line x1="100" y1="-11" x2="100" y2="-5" stroke="#38bdf8" strokeWidth="0.7" />
                      <text x="50" y="-11" textAnchor="middle" fill="#38bdf8" fontSize="5" fontFamily="monospace" fontWeight="bold">
                        100.00 PX
                      </text>

                      {/* Dimension caliper: Height 100 */}
                      <line x1="-8" y1="0" x2="-8" y2="100" stroke="#38bdf8" strokeWidth="0.7" />
                      <line x1="-11" y1="0" x2="-5" y2="0" stroke="#38bdf8" strokeWidth="0.7" />
                      <line x1="-11" y1="100" x2="-5" y2="100" stroke="#38bdf8" strokeWidth="0.7" />
                      <text
                        x="-12"
                        y="50"
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        transform="rotate(-90 -12 50)"
                      >
                        100.00 PX
                      </text>

                      {/* Corner Curvature Callout R=24 */}
                      <text x="78" y="8" fill="#06b6d4" fontSize="4.5" fontFamily="monospace">
                        R=24.0 (r/w = 0.24)
                      </text>
                    </g>
                  )}

                  {/* SQUIRCLE BOUNDARY CONTAINER */}
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    rx="24"
                    fill={showSolidEmblem ? 'url(#miroSquircleFill)' : 'none'}
                    stroke="#00f2fe"
                    strokeWidth="1.2"
                    strokeOpacity={showSolidEmblem ? 0.6 : 0.3}
                    strokeDasharray={showSolidEmblem ? 'none' : '4 3'}
                  />

                  {/* SQUIRCLE GRADIENT DEFINITION */}
                  <defs>
                    <linearGradient id="miroSquircleFill" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#081e2e" stopOpacity="0.85" />
                      <stop offset="50%" stopColor="#05131f" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#020810" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>

                  {/* LAYER 5: SOLID EMBLEM / HARMONIC KINETIC SURGE (Miro Motion Graphics) */}
                  {showSolidEmblem && (
                    <g>
                      {/* Ambient Bloom Backdrop - M Shape */}
                      <path
                        d="M 30 35 L 50 55 L 70 35"
                        fill="none"
                        stroke="#00f2fe"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.2}
                        filter="url(#vectorNeonGlow)"
                      />

                      {/* Miro Harmonic Ribbon Wave (Subtle Cyan Undulation) */}
                      {isPlaying && (
                        <motion.path
                          d="M 30 35 L 50 55 L 70 35"
                          fill="none"
                          stroke="url(#miroRibbon1)"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          animate={{
                            opacity: [0.3, 0.7, 0.3],
                          }}
                          transition={{
                            duration: 3.2 / playbackSpeed,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}

                      {/* Solid Electric Core - M Shape */}
                      <path
                        d="M 30 35 L 50 55 L 70 35"
                        fill="none"
                        stroke="rgba(6, 182, 212, 0.4)"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Crisp Electric Neon Outline - M Shape */}
                      <path
                        d="M 30 35 L 50 55 L 70 35"
                        fill="none"
                        stroke="url(#gridBreakdownNeon)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#vectorNeonGlow)"
                      />

                      {/* Candlestick Bars Glow */}
                      <line x1="75" y1="25" x2="75" y2="50" stroke="#00f2fe" strokeWidth="4" strokeLinecap="round" opacity={0.3} filter="url(#vectorNeonGlow)" />
                      <line x1="82" y1="20" x2="82" y2="50" stroke="#00f2fe" strokeWidth="4" strokeLinecap="round" opacity={0.3} filter="url(#vectorNeonGlow)" />
                      <line x1="89" y1="15" x2="89" y2="50" stroke="#00f2fe" strokeWidth="4" strokeLinecap="round" opacity={0.3} filter="url(#vectorNeonGlow)" />
                    </g>
                  )}

                  {/* LAYER 6: KINETIC LASER PATH TRACER (Draws along vertices in sync) */}
                  {isPlaying && (
                    <motion.path
                      d="M 30 35 L 50 55 L 70 35 M 75 25 L 75 50 M 82 20 L 82 50 M 89 15 L 89 50"
                      fill="none"
                      stroke="url(#laserPulseGrad)"
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="60 180"
                      animate={{
                        strokeDashoffset: [240, 0],
                      }}
                      transition={{
                        duration: 3.0 / playbackSpeed,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                  )}

                  {/* Top-Right Connectivity Beacon Node */}
                  <circle cx="100" cy="0" r="4.5" fill="#00f2fe" stroke="#020810" strokeWidth="2" filter="url(#vectorNeonGlow)" />
                  {isPlaying && (
                    <motion.circle
                      cx="100"
                      cy="0"
                      r="4.5"
                      fill="#00f2fe"
                      animate={{ scale: [1, 2.2, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 2 / playbackSpeed, repeat: Infinity, ease: 'easeOut' }}
                      style={{ transformOrigin: '100px 0px' }}
                    />
                  )}

                  {/* LAYER 7: VERTICES, COORDINATES & TARGET CROSSHAIRS */}
                  {showVertices && (
                    <g className="transition-opacity duration-300">
                      {vertices.map((v) => (
                        <g key={v.id}>
                          {/* Pulsing Target Crosshair */}
                          <circle cx={v.x} cy={v.y} r="2.5" fill="#00f2fe" />
                          <circle
                            cx={v.x}
                            cy={v.y}
                            r="5"
                            stroke="#00f2fe"
                            strokeWidth="0.8"
                            fill="none"
                            strokeDasharray="2 1"
                          />

                          {/* Coordinate Tag Pill */}
                          <rect
                            x={v.tagX}
                            y={v.tagY}
                            width="23"
                            height="8.5"
                            rx="2"
                            fill="#030b17"
                            stroke="#0ea5e9"
                            strokeWidth="0.6"
                          />
                          <text
                            x={v.tagX + 2.5}
                            y={v.tagY + 5.8}
                            fill="#38bdf8"
                            fontSize="4.2"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {v.id}: {v.x},{v.y}
                          </text>
                        </g>
                      ))}
                    </g>
                  )}
                </svg>
              </div>

              {/* Bottom Quick-Status Telemetry inside viewport */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800/80 rounded-xl px-3.5 py-1.5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold">M-SHAPE SYMMETRY</span>
                  <span className="text-slate-600">•</span>
                  <span>6 VECTOR NODES</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400">CANDLESTICK INTEGRATION</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">SPEED:</span>
                  <span className="text-cyan-300 font-bold">{playbackSpeed}X</span>
                </div>
              </div>
            </div>

            {/* Controls & Architectural Breakdown Panel (Right 4 Cols) */}
            <div className="lg:col-span-4 p-5 sm:p-6 bg-[#040916] flex flex-col justify-between overflow-y-auto space-y-6">
              {/* 1. Motion Graphics Playback Controller */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Choreography Control
                  </span>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900 transition-colors cursor-pointer shadow-sm"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3 h-3 fill-current" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>PLAY</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Animation Phase Selector */}
                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                  <button
                    onClick={() => {
                      setActivePhase('loop');
                      setShowGrid(true);
                      setShowCompassCircles(true);
                      setShowAngleGuides(true);
                      setShowVertices(true);
                      setShowSolidEmblem(true);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      activePhase === 'loop'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold shadow-md shadow-cyan-950'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    1. Complete Loop
                  </button>
                  <button
                    onClick={() => {
                      setActivePhase('grid');
                      setShowGrid(true);
                      setShowCompassCircles(true);
                      setShowAngleGuides(true);
                      setShowVertices(true);
                      setShowSolidEmblem(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      activePhase === 'grid'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold shadow-md shadow-cyan-950'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    2. Blueprint Grid
                  </button>
                  <button
                    onClick={() => {
                      setActivePhase('trace');
                      setShowGrid(false);
                      setShowCompassCircles(false);
                      setShowAngleGuides(true);
                      setShowVertices(true);
                      setShowSolidEmblem(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      activePhase === 'trace'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold shadow-md shadow-cyan-950'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    3. Path Tracing
                  </button>
                  <button
                    onClick={() => {
                      setActivePhase('solid');
                      setShowGrid(false);
                      setShowCompassCircles(false);
                      setShowAngleGuides(false);
                      setShowVertices(false);
                      setShowSolidEmblem(true);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      activePhase === 'solid'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold shadow-md shadow-cyan-950'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    4. Solid Emblem
                  </button>
                </div>

                {/* Speed Toggle */}
                <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 p-1.5 rounded-xl text-xs font-mono">
                  <span className="text-slate-400 px-2">Speed</span>
                  <div className="flex items-center gap-1">
                    {[0.5, 1, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                          playbackSpeed === speed
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Grid Layer Visibility Toggles */}
              <div className="space-y-2.5">
                <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Blueprint Grid Layers
                </span>

                <div className="space-y-1.5 text-xs font-mono">
                  {[
                    { label: 'Cartesian Coordinate Grid', val: showGrid, set: setShowGrid },
                    { label: 'Compass Tangent Circles', val: showCompassCircles, set: setShowCompassCircles },
                    { label: '45° / 63.4° Angle Rays', val: showAngleGuides, set: setShowAngleGuides },
                    { label: 'Coordinate Nodes & Tags', val: showVertices, set: setShowVertices },
                    { label: 'Dimensions & Superellipse Calipers', val: showDimensions, set: setShowDimensions },
                    { label: 'Solid Emblem & Specular Infill', val: showSolidEmblem, set: setShowSolidEmblem },
                  ].map((layer, idx) => (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-slate-800/80 hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-300">{layer.label}</span>
                      <input
                        type="checkbox"
                        checked={layer.val}
                        onChange={(e) => layer.set(e.target.checked)}
                        className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Mathematical Architecture Breakdown */}
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <TrendingUp className="w-4 h-4" />
                  <span>Geometry & Proportions</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-500 block">M Shape</span>
                    <span className="font-semibold text-white">Bilateral Symmetry</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Peak Angle</span>
                    <span className="font-semibold text-white">θ = 45.0° (1:1 slope)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Candlesticks</span>
                    <span className="font-semibold text-white">3 Bars Ascending</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Aspect Ratio</span>
                    <span className="font-semibold text-white">1:1 Superellipse</span>
                  </div>
                </div>
              </div>

              {/* Action: Close button */}
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl font-mono font-bold text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-950 transition-all cursor-pointer text-center"
              >
                CLOSE BREAKDOWN VIEW
              </button>
            </div>
          </div>
        </motion.div>
      </div>
  );
}
