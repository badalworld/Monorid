'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MiroStyleLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MiroStyleLogo({
  size = 'md',
  animated = true,
  className = '',
  onClick,
}: MiroStyleLogoProps) {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showConstruction, setShowConstruction] = useState(true);

  const dimensions = {
    sm: { box: 40 },
    md: { box: 46 },
    lg: { box: 64 },
  }[size];

  useEffect(() => {
    if (!animated) return;

    const phases = [0, 1, 2, 3, 4];
    let currentPhase = 0;
    const interval = setInterval(() => {
      currentPhase = (currentPhase + 1) % phases.length;
      setAnimationPhase(currentPhase);

      if (currentPhase === 0 || currentPhase === 4) {
        setShowGrid(false);
        setShowConstruction(false);
      } else if (currentPhase === 1) {
        setShowGrid(true);
        setShowConstruction(false);
      } else if (currentPhase === 2) {
        setShowGrid(true);
        setShowConstruction(true);
      } else if (currentPhase === 3) {
        setShowGrid(false);
        setShowConstruction(true);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [animated]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: dimensions.box, height: dimensions.box }}
    >
      {/* Icon Container */}
      <div className="relative w-full h-full rounded-xl bg-gradient-to-b from-[#0a1628] via-[#061020] to-[#030810] border border-cyan-500/40 shadow-[0_0_18px_rgba(6,182,212,0.3)] overflow-hidden">
        {/* Blueprint Grid */}
        <AnimatePresence>
          {showGrid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }}
            />
          )}
        </AnimatePresence>

        {/* Logo Image - User's Uploaded Monorid Logo */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-1.5">
          <motion.img
            src="/monorid-logo-full.png"
            alt="Monorid Logo"
            className="w-full h-full object-contain"
            style={{ objectPosition: 'center 25%' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </div>

        {/* Construction Circles Overlay */}
        <AnimatePresence>
          {showConstruction && animationPhase >= 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 pointer-events-none z-20"
            >
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="42" stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="28" stroke="#0ea5e9" strokeWidth="0.7" strokeDasharray="2 3" />
                <circle cx="50" cy="50" r="16" stroke="#38bdf8" strokeWidth="0.6" strokeDasharray="2 2" />
                <line x1="15" y1="85" x2="85" y2="15" stroke="#0284c7" strokeWidth="0.6" strokeDasharray="2 2" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vertex Nodes Overlay */}
        <AnimatePresence>
          {showConstruction && animationPhase >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.9, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="absolute inset-0 pointer-events-none z-20"
            >
              <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
                <circle cx="30" cy="35" r="2.5" fill="#00f2fe" />
                <circle cx="70" cy="35" r="2.5" fill="#00f2fe" />
                <circle cx="30" cy="65" r="2.5" fill="#00f2fe" />
                <circle cx="70" cy="65" r="2.5" fill="#00f2fe" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ambient Glow */}
        {animated && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-xl bg-cyan-500/20 blur-lg pointer-events-none"
          />
        )}
      </div>

      {/* Top-Right Beacon */}
      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-[#030712] shadow-[0_0_8px_#22d3ee] z-20">
        {animated && (
          <motion.span
            animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full bg-cyan-400"
          />
        )}
      </div>
    </div>
  );
}
