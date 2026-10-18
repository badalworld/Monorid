'use client';

import React, { useState } from 'react';
import {
  X,
  Shield,
  Key,
  Server,
  Send,
  Sliders,
  Check,
  Copy,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { StrategyConfig, DEFAULT_CONFIG } from '@/lib/strategy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverIp: string;
  apiKey: string;
  setApiKey: (key: string) => void;
  secretKey: string;
  setSecretKey: (secret: string) => void;
  telegramToken: string;
  setTelegramToken: (token: string) => void;
  telegramChatId: string;
  setTelegramChatId: (chatId: string) => void;
  config: StrategyConfig;
  setConfig: React.Dispatch<React.SetStateAction<StrategyConfig>>;
  onTestMexcAuth: () => Promise<{ success: boolean; message: string }>;
  onTestTelegram: () => Promise<{ success: boolean; message: string }>;
}

export function SettingsModal({
  isOpen,
  onClose,
  serverIp,
  apiKey,
  setApiKey,
  secretKey,
  setSecretKey,
  telegramToken,
  setTelegramToken,
  telegramChatId,
  setTelegramChatId,
  config,
  setConfig,
  onTestMexcAuth,
  onTestTelegram,
}: SettingsModalProps) {
  const [copiedIp, setCopiedIp] = useState(false);
  const [testingMexc, setTestingMexc] = useState(false);
  const [mexcResult, setMexcResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingTg, setTestingTg] = useState(false);
  const [tgResult, setTgResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const copyIp = () => {
    if (serverIp) {
      navigator.clipboard.writeText(serverIp);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  const handleTestMexc = async () => {
    setTestingMexc(true);
    setMexcResult(null);
    try {
      const res = await onTestMexcAuth();
      setMexcResult(res);
    } finally {
      setTestingMexc(false);
    }
  };

  const handleTestTg = async () => {
    setTestingTg(true);
    setTgResult(null);
    try {
      const res = await onTestTelegram();
      setTgResult(res);
    } finally {
      setTestingTg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-cyan-500/40 bg-[#060a14] p-5 sm:p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center glow-cyan">
              <Sliders className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-mono font-bold text-white tracking-wide">
                MONORID SETTINGS & SECURITY CONFIGURATION
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Engineered & Developed by Trading Lifestyle Quant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="space-y-5 overflow-y-auto pr-2 py-4 flex-1">
          {/* 1. CRITICAL: Server IPv4 Whitelist Card */}
          <div className="p-4 rounded-xl border-2 border-cyan-500/60 bg-gradient-to-br from-cyan-950/40 via-[#07101e] to-[#040812] glow-cyan">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-300" />
                <span className="text-sm font-mono font-black text-white">
                  SERVER PUBLIC IPv4 ADDRESS FOR WHITELISTING
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                MANDATORY FOR MEXC API
              </span>
            </div>

            <p className="text-xs text-slate-300 font-mono mb-3">
              To secure your funds, MEXC requires IP whitelisting for automated futures trading permissions.
              Copy this exact IPv4 address into your MEXC API Key settings under <span className="text-cyan-300 font-semibold">&quot;IP Address Access&quot;</span>.
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-1 p-2.5 rounded-lg bg-slate-950 border border-cyan-500/50 font-mono text-cyan-300 font-black text-base sm:text-lg tracking-wider text-center select-all">
                {serverIp || 'Detecting Server IPv4...'}
              </div>
              <button
                onClick={copyIp}
                className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-2 shadow-sm glow-cyan transition-all"
              >
                {copiedIp ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy IPv4</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. MEXC API Credentials */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#070c17]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  MEXC Futures API Credentials
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                AES Encrypted & HMAC-SHA256 Signed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  placeholder="e.g. mx0... (MEXC API Key)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">
                  Secret Key
                </label>
                <input
                  type="password"
                  placeholder="e.g. 5f... (MEXC Secret Key)"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] font-mono text-slate-400">
                {mexcResult && (
                  <span className={mexcResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                    {mexcResult.message}
                  </span>
                )}
              </div>

              <button
                onClick={handleTestMexc}
                disabled={testingMexc || !apiKey || !secretKey}
                className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-cyan-300 border border-cyan-800 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingMexc ? 'animate-spin' : ''}`} />
                <span>{testingMexc ? 'Verifying...' : 'Test MEXC Connection'}</span>
              </button>
            </div>
          </div>

          {/* 3. Telegram 24/7 Notification Bot */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#070c17]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  Telegram 24/7 Trade Alerts
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                Real-Time Trade & TP Alerts
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              The bot automatically pushes notifications for every trade entry, TP1 (25%), TP2 (50%), TP3 (Full), and SL trigger.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="password"
                  placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQ..."
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 987654321 or @your_channel"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] font-mono text-slate-400">
                {tgResult && (
                  <span className={tgResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                    {tgResult.message}
                  </span>
                )}
              </div>

              <button
                onClick={handleTestTg}
                disabled={testingTg || !telegramToken || !telegramChatId}
                className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-cyan-300 border border-cyan-800 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testingTg ? 'Sending...' : 'Send Test Alert'}</span>
              </button>
            </div>
          </div>

          {/* 4. Strategy & Risk Parameters */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#070c17]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  Quant Strategy & Execution Parameters
                </h3>
              </div>
              <button
                onClick={() => setConfig(DEFAULT_CONFIG)}
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Equity % / Trade</label>
                <input
                  type="number"
                  value={config.equityRiskPct}
                  onChange={(e) => setConfig({ ...config, equityRiskPct: Number(e.target.value) || 10 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Min Leverage</label>
                <input
                  type="number"
                  value={config.minLeverage}
                  onChange={(e) => setConfig({ ...config, minLeverage: Number(e.target.value) || 10 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Max Leverage</label>
                <input
                  type="number"
                  value={config.maxLeverage}
                  onChange={(e) => setConfig({ ...config, maxLeverage: Number(e.target.value) || 15 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Pivot Length</label>
                <input
                  type="number"
                  value={config.pivotLen}
                  onChange={(e) => setConfig({ ...config, pivotLen: Number(e.target.value) || 8 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Confirm Window</label>
                <input
                  type="number"
                  value={config.confirmWindow}
                  onChange={(e) => setConfig({ ...config, confirmWindow: Number(e.target.value) || 3 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Min Wick %</label>
                <input
                  type="number"
                  value={config.minWickPct}
                  onChange={(e) => setConfig({ ...config, minWickPct: Number(e.target.value) || 25 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">SL ATR Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.slAtrMult}
                  onChange={(e) => setConfig({ ...config, slAtrMult: Number(e.target.value) || 1.5 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Vol Multiplier Req</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.volMultReq}
                  onChange={(e) => setConfig({ ...config, volMultReq: Number(e.target.value) || 1.1 })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Risk/Reward Targets:</span>
              <span className="text-cyan-300 font-bold">
                TP1: {config.rrTp1}x (25% close) • TP2: {config.rrTp2}x (50% close) • TP3: {config.rrTp3}x (100% close)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            Copyright and developed by <span className="text-cyan-300 font-bold">Trading Lifestyle Quant</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs shadow-sm glow-cyan transition-all"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
