'use client';

import React, { useState, useMemo } from 'react';
import { X, TrendingUp, Zap, Radio } from 'lucide-react';
import { Candle, SignalResult, calculateEMA, calculateMonoridIndicator } from '@/lib/strategy';

interface CandleChartModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  candles: Candle[];
  analysis?: SignalResult;
  onQuickTrade?: (side: 'BUY' | 'SELL') => void;
}

const SVG_WIDTH = 760;
const SVG_HEIGHT = 440;
const PADDING = { top: 20, bottom: 25, left: 20, right: 75 };

// Price Candlestick Pane coordinates
const PRICE_TOP = PADDING.top;
const PRICE_HEIGHT = 220;
const PRICE_BOTTOM = PRICE_TOP + PRICE_HEIGHT;

// Monorid Oscillator Sub-Pane coordinates
const SUB_PANE_LABEL_Y = 258;
const MONORID_TOP = 272;
const MONORID_HEIGHT = 138;
const MONORID_BOTTOM = MONORID_TOP + MONORID_HEIGHT;
const MONORID_MID_Y = MONORID_TOP + MONORID_HEIGHT / 2; // zero line
const MONORID_RANGE = 85; // Oscillates between -85 and +85
const VISIBLE_COUNT = 75; // Most recent 75 1M bars (~1.25 hours) for clear candlestick visibility

function formatNum(val: number, decimals = 2): string {
  if (val === undefined || isNaN(val)) return '0.00';
  if (val === 0) return '0.00';
  if (Math.abs(val) < 0.0001) return val.toFixed(8);
  if (Math.abs(val) < 0.01) return val.toFixed(6);
  if (Math.abs(val) < 1) return val.toFixed(4);
  return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function CandleChartModal({
  symbol,
  isOpen,
  onClose,
  candles,
  analysis,
  onQuickTrade,
}: CandleChartModalProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);

  // 1. Calculate technical indicator series across all available historical bars (200+ for accurate EMA)
  const fullEma200Series = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return calculateEMA(candles.map((c) => c.close), 200);
  }, [candles]);

  const { wt1: fullWt1Series, wt2: fullWt2Series } = useMemo(() => {
    if (!candles || candles.length === 0) return { wt1: [], wt2: [] };
    return calculateMonoridIndicator(candles);
  }, [candles]);

  // 2. Viewport window: show latest 75 candles for optimal candlestick and indicator readability
  const visibleCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return candles.slice(-Math.min(candles.length, VISIBLE_COUNT));
  }, [candles]);

  const visibleStartIndex = candles ? candles.length - visibleCandles.length : 0;
  const ema200Series = useMemo(() => fullEma200Series.slice(visibleStartIndex), [fullEma200Series, visibleStartIndex]);
  const wt1Series = useMemo(() => fullWt1Series.slice(visibleStartIndex), [fullWt1Series, visibleStartIndex]);
  const wt2Series = useMemo(() => fullWt2Series.slice(visibleStartIndex), [fullWt2Series, visibleStartIndex]);

  // Telemetry indicators for latest bar
  const latestCandle = visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1] : undefined;
  const currentPrice = latestCandle?.close ?? (analysis?.entryPrice || 0);
  const currentEMA = analysis?.ema ?? (ema200Series.length > 0 ? ema200Series[ema200Series.length - 1] : 0);
  const currentWT1 = analysis?.wt1 ?? (wt1Series.length > 0 ? Number(wt1Series[wt1Series.length - 1].toFixed(1)) : 0);
  const currentWT2 = analysis?.wt2 ?? (wt2Series.length > 0 ? Number(wt2Series[wt2Series.length - 1].toFixed(1)) : 0);
  const monoridDot = analysis?.monoridDot ?? analysis?.cipherDot ?? 'NONE';
  const isPriceAboveEma = currentPrice > currentEMA;

  // Active bar under crosshair cursor (or latest if not hovering)
  const activeIdx = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < visibleCandles.length
    ? hoverIndex
    : (visibleCandles.length - 1);
  const activeCandle = visibleCandles[activeIdx];
  const activeEMA = ema200Series[activeIdx] ?? currentEMA;
  const activeWT1 = wt1Series[activeIdx] !== undefined ? Number(wt1Series[activeIdx].toFixed(1)) : currentWT1;
  const activeWT2 = wt2Series[activeIdx] !== undefined ? Number(wt2Series[activeIdx].toFixed(1)) : currentWT2;

  // 3. Compute price geometry, scales, and visual elements
  const {
    minPrice,
    maxPrice,
    candleElements,
    volumeElements,
    emaPathD,
    lastEmaY,
    entryY,
    slY,
    tpY,
    monoridWt1PathD,
    monoridWt1AreaD,
    monoridWt2PathD,
    crossoverDots,
  } = useMemo(() => {
    if (!visibleCandles || visibleCandles.length === 0) {
      return {
        minPrice: 0,
        maxPrice: 1,
        candleElements: [],
        volumeElements: [],
        emaPathD: '',
        lastEmaY: undefined,
        entryY: undefined,
        slY: undefined,
        tpY: undefined,
        monoridWt1PathD: '',
        monoridWt1AreaD: '',
        monoridWt2PathD: '',
        crossoverDots: [],
      };
    }

    const highs = visibleCandles.map((c) => c.high);
    const lows = visibleCandles.map((c) => c.low);
    const vols = visibleCandles.map((c) => c.volume);
    const maxVol = Math.max(...vols, 1);

    // Expand price bounds if analysis SL / TP exist
    if (analysis?.slLevel) {
      lows.push(analysis.slLevel);
      highs.push(analysis.slLevel);
    }
    const targetTp = analysis?.tpLevel ?? analysis?.tp1Level;
    if (targetTp) {
      lows.push(targetTp);
      highs.push(targetTp);
    }

    // Include visible EMA 200 values in price scale
    ema200Series.forEach((ema) => {
      if (ema > 0) {
        highs.push(ema);
        lows.push(ema);
      }
    });

    let min = Math.min(...lows);
    let max = Math.max(...highs);
    const range = max - min || 1;
    min -= range * 0.05;
    max += range * 0.05;

    const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right;
    const candleWidth = Math.max(3, plotWidth / visibleCandles.length - 2.5);

    const priceToY = (p: number) => {
      return PRICE_TOP + PRICE_HEIGHT - ((p - min) / (max - min)) * PRICE_HEIGHT;
    };

    const monoridToY = (val: number) => {
      const clamped = Math.max(-MONORID_RANGE, Math.min(MONORID_RANGE, val));
      return MONORID_MID_Y - (clamped / MONORID_RANGE) * (MONORID_HEIGHT / 2);
    };

    // Candlesticks
    const cEls = visibleCandles.map((c, i) => {
      const x = PADDING.left + i * (plotWidth / visibleCandles.length) + (plotWidth / visibleCandles.length - candleWidth) / 2;
      const isGreen = c.close >= c.open;
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      const bodyY = Math.min(openY, closeY);
      const bodyH = Math.max(1.5, Math.abs(closeY - openY));

      return {
        x,
        openY,
        closeY,
        highY,
        lowY,
        bodyY,
        bodyH,
        width: candleWidth,
        isGreen,
      };
    });

    // Volume bars inside lower 35px of price pane
    const vEls = visibleCandles.map((c, i) => {
      const x = PADDING.left + i * (plotWidth / visibleCandles.length) + (plotWidth / visibleCandles.length - candleWidth) / 2;
      const h = (c.volume / maxVol) * 35;
      const y = PRICE_BOTTOM - h;
      return { x, y, h, width: candleWidth, isGreen: c.close >= c.open };
    });

    // 200 EMA Overlay Line Path
    let emaPath = '';
    let endEmaY: number | undefined;
    for (let i = 0; i < visibleCandles.length; i++) {
      const emaVal = ema200Series[i];
      if (emaVal && emaVal > 0) {
        const x = PADDING.left + i * (plotWidth / visibleCandles.length) + (plotWidth / visibleCandles.length) / 2;
        const y = priceToY(emaVal);
        if (!emaPath) {
          emaPath = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
          emaPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        if (i === visibleCandles.length - 1) endEmaY = y;
      }
    }

    // Trade Levels
    const enY = analysis?.entryPrice ? priceToY(analysis.entryPrice) : undefined;
    const sY = analysis?.slLevel ? priceToY(analysis.slLevel) : undefined;
    const tY = targetTp ? priceToY(targetTp) : undefined;

    // Monorid Sub-Pane Paths (WT1 and WT2)
    let wt1Path = '';
    let wt1Area = '';
    let wt2Path = '';
    const dots: Array<{ x: number; y: number; type: 'GREEN' | 'RED'; wt1: number; wt2: number; index: number }> = [];

    for (let i = 0; i < visibleCandles.length; i++) {
      const x = PADDING.left + i * (plotWidth / visibleCandles.length) + (plotWidth / visibleCandles.length) / 2;
      const w1 = wt1Series[i] ?? 0;
      const w2 = wt2Series[i] ?? 0;
      const y1 = monoridToY(w1);
      const y2 = monoridToY(w2);

      if (i === 0) {
        wt1Path = `M ${x.toFixed(1)} ${y1.toFixed(1)}`;
        wt1Area = `M ${x.toFixed(1)} ${MONORID_MID_Y.toFixed(1)} L ${x.toFixed(1)} ${y1.toFixed(1)}`;
        wt2Path = `M ${x.toFixed(1)} ${y2.toFixed(1)}`;
      } else {
        wt1Path += ` L ${x.toFixed(1)} ${y1.toFixed(1)}`;
        wt1Area += ` L ${x.toFixed(1)} ${y1.toFixed(1)}`;
        wt2Path += ` L ${x.toFixed(1)} ${y2.toFixed(1)}`;

        // Check crossover dots matching Monorid Quant rules
        const prevW1 = wt1Series[i - 1] ?? 0;
        const prevW2 = wt2Series[i - 1] ?? 0;

        // Bullish Green Dot: WT1 crosses above WT2 in Oversold zone (<= -53)
        const isBullCross = prevW1 <= prevW2 && w1 > w2;
        const isOversold = w1 <= -53 || w2 <= -53 || prevW1 <= -53 || prevW2 <= -53;
        if (isBullCross && isOversold) {
          dots.push({ x, y: y2, type: 'GREEN', wt1: w1, wt2: w2, index: i });
        }

        // Bearish Red Dot: WT1 crosses below WT2 in Overbought zone (>= 53)
        const isBearCross = prevW1 >= prevW2 && w1 < w2;
        const isOverbought = w1 >= 53 || w2 >= 53 || prevW1 >= 53 || prevW2 >= 53;
        if (isBearCross && isOverbought) {
          dots.push({ x, y: y2, type: 'RED', wt1: w1, wt2: w2, index: i });
        }
      }

      if (i === visibleCandles.length - 1) {
        wt1Area += ` L ${x.toFixed(1)} ${MONORID_MID_Y.toFixed(1)} Z`;
      }
    }

    return {
      minPrice: min,
      maxPrice: max,
      candleElements: cEls,
      volumeElements: vEls,
      emaPathD: emaPath,
      lastEmaY: endEmaY,
      entryY: enY,
      slY: sY,
      tpY: tY,
      monoridWt1PathD: wt1Path,
      monoridWt1AreaD: wt1Area,
      monoridWt2PathD: wt2Path,
      crossoverDots: dots,
    };
  }, [visibleCandles, analysis, ema200Series, wt1Series, wt2Series]);

  if (!isOpen) return null;

  // Active dot at hovered/selected candle
  const activeDot = crossoverDots.find((d) => d.index === activeIdx);
  const activeDotLabel = activeDot
    ? activeDot.type === 'GREEN'
      ? '🟢 GREEN DOT (OS)'
      : '🔴 RED DOT (OB)'
    : (activeIdx === visibleCandles.length - 1 && monoridDot !== 'NONE'
        ? (monoridDot === 'GREEN' ? '🟢 GREEN DOT (OS)' : '🔴 RED DOT (OB)')
        : '⚪ NEUTRAL');

  // Mouse move handler for interactive crosshair inspection
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_HEIGHT;
    setMouseY(y);

    const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right;
    if (x >= PADDING.left && x <= SVG_WIDTH - PADDING.right && visibleCandles.length > 0) {
      const idx = Math.floor(((x - PADDING.left) / plotWidth) * visibleCandles.length);
      setHoverIndex(Math.max(0, Math.min(visibleCandles.length - 1, idx)));
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMouseY(null);
  };

  // Crosshair coordinate calculations
  const crosshairX = hoverIndex !== null && candleElements[hoverIndex]
    ? candleElements[hoverIndex].x + candleElements[hoverIndex].width / 2
    : null;
  const hoverPrice = mouseY !== null && mouseY >= PRICE_TOP && mouseY <= PRICE_BOTTOM
    ? maxPrice - ((mouseY - PRICE_TOP) / PRICE_HEIGHT) * (maxPrice - minPrice)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl rounded-2xl border border-cyan-500/40 bg-[#060a14] p-4 sm:p-5 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-mono font-black text-white">{symbol}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold">
                  1M CANDLES ({visibleCandles.length} VISIBLE / {candles?.length || 0} TOTAL)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  ${formatNum(currentPrice)}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isPriceAboveEma ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700' : 'bg-rose-950/70 text-rose-300 border-rose-700'
                }`}>
                  {isPriceAboveEma ? 'PRICE > EMA 200 (BULL BIAS)' : 'PRICE < EMA 200 (BEAR BIAS)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                1M High-Precision Scalp Chart • Monorid Algorithm + EMA 200 Trend Strategy Engine • Copyright and developed by Trading Lifestyle Quant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quant Telemetry Banner with Real-time & Crosshair Indicator Positions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono">
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Monorid Oscillator</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`font-bold ${activeWT1 <= -53 ? 'text-emerald-400' : activeWT1 >= 53 ? 'text-rose-400' : 'text-cyan-300'}`}>
                WT1: {activeWT1}
              </span>
              <span className="text-slate-500">/</span>
              <span className="font-bold text-purple-300">WT2: {activeWT2}</span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Monorid Dot Status</span>
            <div className="mt-0.5">
              <span className={`font-bold inline-flex items-center gap-1 ${
                activeDotLabel.includes('GREEN')
                  ? 'text-emerald-400 font-black'
                  : activeDotLabel.includes('RED')
                  ? 'text-rose-400 font-black'
                  : 'text-slate-400'
              }`}>
                {activeDotLabel}
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">EMA 200 Indicator</span>
            <span className="text-cyan-400 font-bold block mt-0.5">
              ${formatNum(activeEMA)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Strategy Trigger</span>
            <span className={`font-bold block mt-0.5 ${
              analysis?.action === 'BUY'
                ? 'text-emerald-400'
                : analysis?.action === 'SELL'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}>
              {analysis?.action === 'BUY'
                ? 'BUY SIGNAL (LONG)'
                : analysis?.action === 'SELL'
                ? 'SELL SIGNAL (SHORT)'
                : 'HOLD / NEUTRAL'}
            </span>
          </div>
        </div>

        {/* Dynamic Candle Telemetry Bar on Crosshair Hover */}
        {activeCandle && (
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 px-3 py-1.5 mb-2 rounded-lg bg-[#080e1c] border border-cyan-900/40 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-cyan-400 font-bold">
                {new Date(activeCandle.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>O: <strong className="text-white">${formatNum(activeCandle.open)}</strong></span>
              <span>H: <strong className="text-white">${formatNum(activeCandle.high)}</strong></span>
              <span>L: <strong className="text-white">${formatNum(activeCandle.low)}</strong></span>
              <span>C: <strong className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>${formatNum(activeCandle.close)}</strong></span>
            </div>
            <div className="flex items-center gap-3 ml-auto text-[10px]">
              <span className="text-cyan-300">EMA200: <strong>${formatNum(activeEMA)}</strong></span>
              <span className="text-emerald-400">WT1: <strong>{activeWT1}</strong></span>
              <span className="text-purple-300">WT2: <strong>{activeWT2}</strong></span>
              {hoverIndex !== null && <span className="text-amber-400 font-semibold">[INSPECT BAR]</span>}
            </div>
          </div>
        )}

        {/* Visual Dual-Pane SVG Canvas: Price Candlesticks + EMA 200 Overlay + Monorid Sub-Pane */}
        <div className="relative w-full h-[400px] sm:h-[430px] bg-[#040711] rounded-xl border border-slate-800/90 overflow-hidden shadow-inner select-none">
          {visibleCandles.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
              <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
              <span>Fetching 1M candlestick stream and computing Monorid & EMA 200 indicators...</span>
            </div>
          ) : (
            <svg
              className="w-full h-full cursor-crosshair"
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Gradients */}
                <linearGradient id="monoridAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="emaGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>

              {/* ── PRICE PANE (Candlesticks & 200 EMA Overlay) ── */}
              {/* Price Grid horizontal lines */}
              {[0.2, 0.4, 0.6, 0.8].map((pct, idx) => (
                <line
                  key={`price-grid-${idx}`}
                  x1={PADDING.left}
                  y1={PRICE_TOP + PRICE_HEIGHT * pct}
                  x2={SVG_WIDTH - PADDING.right}
                  y2={PRICE_TOP + PRICE_HEIGHT * pct}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  opacity="0.4"
                />
              ))}

              {/* Risk / Reward Shading Box */}
              {entryY && slY && (
                <rect
                  x={PADDING.left}
                  y={Math.min(entryY, slY)}
                  width={SVG_WIDTH - PADDING.left - PADDING.right}
                  height={Math.abs(slY - entryY)}
                  fill="rgba(244, 63, 94, 0.12)"
                />
              )}
              {entryY && tpY && (
                <rect
                  x={PADDING.left}
                  y={Math.min(entryY, tpY)}
                  width={SVG_WIDTH - PADDING.left - PADDING.right}
                  height={Math.abs(tpY - entryY)}
                  fill="rgba(16, 185, 129, 0.12)"
                />
              )}

              {/* Volume bars inside lower price pane */}
              {volumeElements.map((v, i) => (
                <rect
                  key={`vol-${i}`}
                  x={v.x}
                  y={v.y}
                  width={v.width}
                  height={v.h}
                  fill={v.isGreen ? 'rgba(52, 211, 153, 0.25)' : 'rgba(248, 113, 113, 0.25)'}
                />
              ))}

              {/* Candlesticks */}
              {candleElements.map((c, i) => (
                <g key={`candle-${i}`}>
                  {/* Wick */}
                  <line
                    x1={c.x + c.width / 2}
                    y1={c.highY}
                    x2={c.x + c.width / 2}
                    y2={c.lowY}
                    stroke={c.isGreen ? '#34d399' : '#f87171'}
                    strokeWidth="1.2"
                  />
                  {/* Body */}
                  <rect
                    x={c.x}
                    y={c.bodyY}
                    width={c.width}
                    height={c.bodyH}
                    fill={c.isGreen ? '#10b981' : '#ef4444'}
                    rx="0.5"
                  />
                </g>
              ))}

              {/* 200 EMA Overlay Line directly on Candlesticks */}
              {emaPathD && (
                <g>
                  <path
                    d={emaPathD}
                    fill="none"
                    stroke="url(#emaGlow)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                  />
                  {lastEmaY && (
                    <g>
                      <rect
                        x={SVG_WIDTH - PADDING.right + 2}
                        y={lastEmaY - 8}
                        width={70}
                        height={16}
                        rx="3"
                        fill="#083344"
                        stroke="#06b6d4"
                        strokeWidth="1"
                      />
                      <text
                        x={SVG_WIDTH - PADDING.right + 6}
                        y={lastEmaY + 4}
                        fill="#38bdf8"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        EMA 200
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* Trade Levels: Entry, SL (EMA 200), TP (1:2 Target) */}
              {entryY && (
                <g>
                  <line
                    x1={PADDING.left}
                    y1={entryY}
                    x2={SVG_WIDTH - PADDING.right}
                    y2={entryY}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  <text
                    x={SVG_WIDTH - PADDING.right + 5}
                    y={entryY + 4}
                    fill="#38bdf8"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ENTRY
                  </text>
                </g>
              )}

              {slY && (
                <g>
                  <line
                    x1={PADDING.left}
                    y1={slY}
                    x2={SVG_WIDTH - PADDING.right}
                    y2={slY}
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={SVG_WIDTH - PADDING.right + 5}
                    y={slY + 4}
                    fill="#f43f5e"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    SL (EMA)
                  </text>
                </g>
              )}

              {tpY && (
                <g>
                  <line
                    x1={PADDING.left}
                    y1={tpY}
                    x2={SVG_WIDTH - PADDING.right}
                    y2={tpY}
                    stroke="#10b981"
                    strokeWidth="1.8"
                  />
                  <text
                    x={SVG_WIDTH - PADDING.right + 5}
                    y={tpY + 4}
                    fill="#10b981"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    TP 1:2
                  </text>
                </g>
              )}

              {/* Price scale top/bottom labels */}
              <text x={SVG_WIDTH - PADDING.right + 5} y={PRICE_TOP + 10} fill="#64748b" fontSize="8" fontFamily="monospace">
                ${formatNum(maxPrice)}
              </text>
              <text x={SVG_WIDTH - PADDING.right + 5} y={PRICE_BOTTOM - 2} fill="#64748b" fontSize="8" fontFamily="monospace">
                ${formatNum(minPrice)}
              </text>

              {/* ── PANE DIVIDER & SUB-PANE HEADER ── */}
              <line
                x1={PADDING.left}
                y1={SUB_PANE_LABEL_Y}
                x2={SVG_WIDTH - PADDING.right}
                y2={SUB_PANE_LABEL_Y}
                stroke="#1e293b"
                strokeWidth="1.5"
              />
              <rect
                x={PADDING.left}
                y={SUB_PANE_LABEL_Y - 9}
                width={260}
                height={16}
                rx="3"
                fill="#060a14"
              />
              <text
                x={PADDING.left + 4}
                y={SUB_PANE_LABEL_Y + 3}
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                MONORID OSCILLATOR (WT1 / WT2)
              </text>

              {/* ── SUB-PANE: MONORID OSCILLATOR (Copyright and developed by Trading Lifestyle Quant) ── */}
              {/* Zero Center Line */}
              <line
                x1={PADDING.left}
                y1={MONORID_MID_Y}
                x2={SVG_WIDTH - PADDING.right}
                y2={MONORID_MID_Y}
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text x={SVG_WIDTH - PADDING.right + 5} y={MONORID_MID_Y + 3} fill="#64748b" fontSize="8" fontFamily="monospace">
                0
              </text>

              {/* Overbought Horizontal Lines (+60 Level 1, +53 Level 2) */}
              <line
                x1={PADDING.left}
                y1={MONORID_MID_Y - (60 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                x2={SVG_WIDTH - PADDING.right}
                y2={MONORID_MID_Y - (60 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                stroke="#ef4444"
                strokeWidth="1"
                opacity="0.8"
              />
              <text
                x={SVG_WIDTH - PADDING.right + 5}
                y={MONORID_MID_Y - (60 / MONORID_RANGE) * (MONORID_HEIGHT / 2) + 3}
                fill="#ef4444"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                +60
              </text>

              <line
                x1={PADDING.left}
                y1={MONORID_MID_Y - (53 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                x2={SVG_WIDTH - PADDING.right}
                y2={MONORID_MID_Y - (53 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                stroke="#f87171"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity="0.7"
              />
              <text
                x={SVG_WIDTH - PADDING.right + 5}
                y={MONORID_MID_Y - (53 / MONORID_RANGE) * (MONORID_HEIGHT / 2) + 3}
                fill="#f87171"
                fontSize="8"
                fontFamily="monospace"
              >
                +53 OB
              </text>

              {/* Oversold Horizontal Lines (-53 Level 2, -60 Level 1) */}
              <line
                x1={PADDING.left}
                y1={MONORID_MID_Y - (-53 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                x2={SVG_WIDTH - PADDING.right}
                y2={MONORID_MID_Y - (-53 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                stroke="#34d399"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity="0.7"
              />
              <text
                x={SVG_WIDTH - PADDING.right + 5}
                y={MONORID_MID_Y - (-53 / MONORID_RANGE) * (MONORID_HEIGHT / 2) + 3}
                fill="#34d399"
                fontSize="8"
                fontFamily="monospace"
              >
                -53 OS
              </text>

              <line
                x1={PADDING.left}
                y1={MONORID_MID_Y - (-60 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                x2={SVG_WIDTH - PADDING.right}
                y2={MONORID_MID_Y - (-60 / MONORID_RANGE) * (MONORID_HEIGHT / 2)}
                stroke="#10b981"
                strokeWidth="1"
                opacity="0.8"
              />
              <text
                x={SVG_WIDTH - PADDING.right + 5}
                y={MONORID_MID_Y - (-60 / MONORID_RANGE) * (MONORID_HEIGHT / 2) + 3}
                fill="#10b981"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                -60
              </text>

              {/* WT1 Shaded Area */}
              {monoridWt1AreaD && (
                <path d={monoridWt1AreaD} fill="url(#monoridAreaGrad)" />
              )}

              {/* WT1 Wave Line (Emerald/Teal, Fast Wave) */}
              {monoridWt1PathD && (
                <path
                  d={monoridWt1PathD}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* WT2 Wave Line (Purple/Violet, Slow Wave SMA 4) */}
              {monoridWt2PathD && (
                <path
                  d={monoridWt2PathD}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Crossover Dots (Green in OS / Red in OB) Matching Monorid Design */}
              {crossoverDots.map((dot, idx) => (
                <g key={`dot-${idx}`}>
                  {/* Glow ring */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="7"
                    fill="none"
                    stroke={dot.type === 'GREEN' ? '#10b981' : '#ef4444'}
                    strokeWidth="1.5"
                    opacity="0.75"
                    className="animate-pulse"
                  />
                  {/* Solid Dot */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="4.5"
                    fill={dot.type === 'GREEN' ? '#10b981' : '#ef4444'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              ))}

              {/* Sub-pane legend (bottom left inside sub-pane) */}
              <g transform={`translate(${PADDING.left + 5}, ${MONORID_BOTTOM - 8})`}>
                <line x1="0" y1="0" x2="12" y2="0" stroke="#10b981" strokeWidth="2" />
                <text x="16" y="3" fill="#34d399" fontSize="8" fontFamily="monospace">WT1 (Wave 1)</text>

                <line x1="90" y1="0" x2="102" y2="0" stroke="#c084fc" strokeWidth="2" />
                <text x="106" y="3" fill="#c084fc" fontSize="8" fontFamily="monospace">WT2 (SMA 4)</text>

                <circle cx="180" cy="0" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                <text x="188" y="3" fill="#10b981" fontSize="8" fontFamily="monospace">Green Dot (OS)</text>

                <circle cx="265" cy="0" r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                <text x="273" y="3" fill="#ef4444" fontSize="8" fontFamily="monospace">Red Dot (OB)</text>
              </g>

              {/* Interactive Crosshair Guidelines */}
              {crosshairX !== null && (
                <line
                  x1={crosshairX}
                  y1={PRICE_TOP}
                  x2={crosshairX}
                  y2={MONORID_BOTTOM}
                  stroke="#38bdf8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />
              )}
              {hoverPrice !== null && mouseY !== null && (
                <g>
                  <line
                    x1={PADDING.left}
                    y1={mouseY}
                    x2={SVG_WIDTH - PADDING.right}
                    y2={mouseY}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.75"
                  />
                  <rect
                    x={SVG_WIDTH - PADDING.right + 2}
                    y={mouseY - 7}
                    width={70}
                    height={14}
                    rx="2"
                    fill="#0284c7"
                  />
                  <text
                    x={SVG_WIDTH - PADDING.right + 5}
                    y={mouseY + 3}
                    fill="#ffffff"
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ${formatNum(hoverPrice)}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>

        {/* Footer Targets Legend & Execution Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-3 text-[11px] font-mono flex-wrap">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2.5 h-1 bg-cyan-400 rounded-sm"></span> Entry: ${analysis?.entryPrice ? formatNum(analysis.entryPrice) : '—'}
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-1 bg-rose-500 rounded-sm"></span> SL (EMA 200): ${analysis?.slLevel ? formatNum(analysis.slLevel) : '—'}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2.5 h-1 bg-emerald-500 rounded-sm"></span> TP (1:2 R:R Target): ${(analysis?.tpLevel || analysis?.tp1Level) ? formatNum((analysis?.tpLevel || analysis?.tp1Level)!) : '—'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono ml-auto">
            <span className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>MONORID 1:2 ENGINE</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
