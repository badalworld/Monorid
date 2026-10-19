'use client';

import React, { useMemo } from 'react';
import { X, TrendingUp, Shield, Target, Zap, Activity } from 'lucide-react';
import { Candle, SignalResult } from '@/lib/strategy';

interface CandleChartModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  candles: Candle[];
  analysis?: SignalResult;
  onQuickTrade?: (side: 'BUY' | 'SELL') => void;
}

const CHART_HEIGHT = 280;
const CHART_WIDTH = 720;
const CHART_PADDING = { top: 25, bottom: 40, left: 20, right: 75 };

export function CandleChartModal({
  symbol,
  isOpen,
  onClose,
  candles,
  analysis,
  onQuickTrade,
}: CandleChartModalProps) {
  const { minPrice, maxPrice, candleElements, volumeElements, lastPrice } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { minPrice: 0, maxPrice: 1, candleElements: [], volumeElements: [], lastPrice: 0 };
    }

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const vols = candles.map((c) => c.volume);
    const maxVol = Math.max(...vols, 1);

    // If analysis has SL/TP, expand price bounds to fit them
    if (analysis?.slLevel) {
      lows.push(analysis.slLevel);
      highs.push(analysis.slLevel);
    }
    if (analysis?.tp3Level) {
      lows.push(analysis.tp3Level);
      highs.push(analysis.tp3Level);
    }

    let min = Math.min(...lows);
    let max = Math.max(...highs);
    const range = max - min || 1;
    min -= range * 0.05;
    max += range * 0.05;

    const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const candleWidth = Math.max(3, plotWidth / candles.length - 2);

    const priceToY = (p: number) => CHART_PADDING.top + plotHeight - ((p - min) / (max - min)) * plotHeight;

    const cEls = candles.map((c, i) => {
      const x = CHART_PADDING.left + i * (plotWidth / candles.length) + (plotWidth / candles.length - candleWidth) / 2;
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

    const vEls = candles.map((c, i) => {
      const x = CHART_PADDING.left + i * (plotWidth / candles.length) + (plotWidth / candles.length - candleWidth) / 2;
      const h = (c.volume / maxVol) * 45;
      const y = CHART_HEIGHT - CHART_PADDING.bottom + (45 - h);
      return { x, y, h, width: candleWidth, isGreen: c.close >= c.open };
    });

    const last = candles[candles.length - 1].close;

    return { minPrice: min, maxPrice: max, candleElements: cEls, volumeElements: vEls, lastPrice: last };
  }, [candles, analysis]);

  if (!isOpen) return null;

  const priceToY = (p: number) => {
    const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    return CHART_PADDING.top + plotHeight - ((p - minPrice) / (maxPrice - minPrice)) * plotHeight;
  };

  const entryY = analysis?.entryPrice ? priceToY(analysis.entryPrice) : undefined;
  const slY = analysis?.slLevel ? priceToY(analysis.slLevel) : undefined;
  const tp1Y = analysis?.tp1Level ? priceToY(analysis.tp1Level) : undefined;
  const tp2Y = analysis?.tp2Level ? priceToY(analysis.tp2Level) : undefined;
  const tp3Y = analysis?.tp3Level ? priceToY(analysis.tp3Level) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl rounded-2xl border border-cyan-500/40 bg-[#060a14] p-5 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-mono font-black text-white">{symbol}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  3-MIN CANDLES
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  ${lastPrice < 0.01 ? lastPrice.toFixed(6) : lastPrice.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Trading Lifestyle Quant Engine • CRUDE OIL Signal Execution (EMA 200 Filter)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quant Telemetry Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-850 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block">RSI</span>
            <span className={`font-bold ${
              (analysis?.rsi ?? 50) > 70 ? 'text-rose-400' : (analysis?.rsi ?? 50) < 30 ? 'text-emerald-400' : 'text-white'
            }`}>{analysis?.rsi?.toFixed(1) ?? '50.0'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">SMA 70</span>
            <span className="text-cyan-400 font-bold">${analysis?.sma?.toFixed(2) ?? '—'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">EMA 200</span>
            <span className="text-emerald-400 font-bold">${analysis?.ema?.toFixed(2) ?? '—'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">EMA FILTER</span>
            <span className={`font-bold ${analysis?.emaFilterOK ? 'text-emerald-400' : 'text-slate-400'}`}>
              {analysis?.emaFilterOK ? '✓ CONFIRMED' : '✗ FILTERED'}
            </span>
          </div>
        </div>

        {/* Visual Candlestick & Target SVG Canvas */}
        <div className="relative w-full h-[280px] bg-[#040711] rounded-xl border border-slate-800/90 overflow-hidden">
          <svg className="w-full h-full" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
            {/* Grid horizontal lines */}
            {[0.2, 0.4, 0.6, 0.8].map((pct, idx) => (
              <line
                key={`grid-${idx}`}
                x1={CHART_PADDING.left}
                y1={CHART_PADDING.top + (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom) * pct}
                x2={CHART_WIDTH - CHART_PADDING.right}
                y2={CHART_PADDING.top + (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom) * pct}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity="0.5"
              />
            ))}

            {/* Risk / Reward Shading Box */}
            {entryY && slY && (
              <rect
                x={CHART_PADDING.left}
                y={Math.min(entryY, slY)}
                width={CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right}
                height={Math.abs(slY - entryY)}
                fill="rgba(244, 63, 94, 0.12)"
              />
            )}
            {entryY && tp3Y && (
              <rect
                x={CHART_PADDING.left}
                y={Math.min(entryY, tp3Y)}
                width={CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right}
                height={Math.abs(tp3Y - entryY)}
                fill="rgba(16, 185, 129, 0.12)"
              />
            )}

            {/* Volume bars */}
            {volumeElements.map((v, i) => (
              <rect
                key={`vol-${i}`}
                x={v.x}
                y={v.y}
                width={v.width}
                height={v.h}
                fill={v.isGreen ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}
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

            {/* Target & Stop Loss Lines */}
            {entryY && (
              <g>
                <line
                  x1={CHART_PADDING.left}
                  y1={entryY}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={entryY}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING.right + 5}
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
                  x1={CHART_PADDING.left}
                  y1={slY}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={slY}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING.right + 5}
                  y={slY + 4}
                  fill="#f43f5e"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  SL
                </text>
              </g>
            )}

            {tp1Y && (
              <g>
                <line
                  x1={CHART_PADDING.left}
                  y1={tp1Y}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={tp1Y}
                  stroke="#34d399"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING.right + 5}
                  y={tp1Y + 4}
                  fill="#34d399"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  TP1 (25%)
                </text>
              </g>
            )}

            {tp2Y && (
              <g>
                <line
                  x1={CHART_PADDING.left}
                  y1={tp2Y}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={tp2Y}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING.right + 5}
                  y={tp2Y + 4}
                  fill="#10b981"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  TP2 (50%)
                </text>
              </g>
            )}

            {tp3Y && (
              <g>
                <line
                  x1={CHART_PADDING.left}
                  y1={tp3Y}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={tp3Y}
                  stroke="#22d3ee"
                  strokeWidth="1.8"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING.right + 5}
                  y={tp3Y + 4}
                  fill="#22d3ee"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  TP3 (100%)
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Footer Targets Legend & Automated Status */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-3 text-[11px] font-mono flex-wrap">
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="w-2.5 h-0.5 bg-cyan-400"></span> Entry
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-0.5 bg-rose-500 border-dashed"></span> SL: ${analysis?.slLevel?.toFixed(4) || '—'}
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-500"></span> TP1 (25%): ${analysis?.tp1Level?.toFixed(4) || '—'}
            </span>
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="w-2.5 h-0.5 bg-emerald-400"></span> TP2 (50%): ${analysis?.tp2Level?.toFixed(4) || '—'}
            </span>
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="w-2.5 h-0.5 bg-cyan-300"></span> TP3 (Full): ${analysis?.tp3Level?.toFixed(4) || '—'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>100% FULL AUTOMATIC TRADING</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
