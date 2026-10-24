# Monorid — Autonomous High-Frequency MEXC Futures Quant Engine

> **Copyright and developed by Trading Lifestyle Quant**

[![Production Deployment](https://img.shields.io/badge/Deployment-Aiven%20Runtime%20%2F%20Docker-blue?style=for-the-badge&logo=docker)](https://github.com/badalworld/Monorid)
[![Framework](https://img.shields.io/badge/Framework-Next.js%2015%20%7C%20React%2019-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Language](https://img.shields.io/badge/Language-TypeScript%205.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Exchange Engine](https://img.shields.io/badge/Exchange-MEXC%20Contract%20v1-teal?style=for-the-badge)](https://www.mexc.com/)
[![Risk-Reward](https://img.shields.io/badge/Execution-1%3A2%20R%3AR%20%7C%20EMA%20200%20SL-success?style=for-the-badge)](#algorithmic-execution--risk-management)

---

## Executive Summary

**Monorid** is an institutional-grade, fully autonomous quantitative trading system engineered for high-frequency algorithmic scalping on **MEXC Perpetual Futures**. Operating on continuous 1-minute execution cycles, Monorid analyzes liquidity, volatility, multi-factor wave momentum convergence, and macroeconomic trend alignment across a universe of 90 cryptocurrency perpetual futures contracts.

Monorid combines real-time low-latency WebSocket order book feeds, rigorous mathematical wave oscillators, automated risk/reward execution rules, strict balance safety gates, and enterprise-grade trade lifecycle management to execute systematic scalping strategies with zero human emotional latency.

---

## System Architecture

```
                                  ┌──────────────────────────────────────────────┐
                                  │            MEXC CONTRACT GATEWAY             │
                                  │   (REST API v1 / WebSocket Edge Feed)        │
                                  └───────┬──────────────────────────────▲───────┘
                                          │ Real-Time Ticks &            │ Signed HMAC-SHA256
                                          │ K-Line Candles               │ Execution Orders
                                          ▼                              │
┌────────────────────────────────────────────────────────────────────────┴───────┐
│                               MONORID QUANT CORE                               │
│                                                                                │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐  │
│  │   90-Contract Market   │  │   Monorid Dual-Wave    │  │  Risk Management │  │
│  │   Scanner (6 Tiers)    │─▶│   Momentum Oscillator  │─▶│  & Position Sizer│  │
│  │  Adaptive Spread/Vol   │  │  Multi-Factor Engine   │  │  1:2 R:R Targets │  │
│  └────────────────────────┘  └────────────────────────┘  └────────┬─────────┘  │
│                                                                   │            │
│  ┌────────────────────────┐  ┌────────────────────────┐           ▼            │
│  │  Telegram Notification │  │   $0.70 USDT Safety    │  ┌──────────────────┐  │
│  │    Telemetry Stream    │◀─│    Balance Hard-Gate   │◀─│ Order Dispatch & │  │
│  │    Real-Time Alerts    │  │  Pre-Flight Validation │  │ Execution Engine │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────────┘  │
└────────────────────────────────────────┬───────────────────────────────────────┘
                                         │ React 19 / Next.js 15
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                       MONORID CYBERNETIC DASHBOARD UI                          │
│   • Bot Constellation Hub       • Live Candlestick & Dynamic Chart Inspector   │
│   • Real-Time Active Positions  • Verified Closed PnL, Fees & Funding Auditor  │
│   • Server IP & Node Diagnostics• High-Precision Risk Management Console       │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Institutional Features

### 1. Ultra-Fast Parallel 90-Contract Market Scanner Across 6 Tiers
Monorid features a high-throughput parallel execution pipeline scanning 90 top-tier perpetual futures contracts concurrently:
- **Parallel Threading**: Executes multi-tier kline requests with managed 16-worker concurrency, completing entire 90-contract market scans in **under 2 seconds** (<2s latency).
- **Rapid 12s Scanning Cadence**: Operates continuous 12-second scan cycles, capturing 1-minute wave convergence opportunities within seconds of candle formation.
- **6 Volatility Clusters (15 Contracts Each)**:
  - **Apex Cyber-Volatiles**: Top 15 contracts exhibiting maximum volatility, extreme turnover velocity, and strong 24-hour directional momentum.
  - **Titan Momentum Core**: High-capitalization liquid anchors with elevated trading volume, tight spreads, and sustained breakout follow-through.
  - **Quantum Velocity**: High-beta momentum contracts with expansive intraday price velocity and clean swing amplitude.
  - **DeFi & Layer-1 Vanguard**: Decentralized finance ecosystems, Layer-1/Layer-2 networks, and modular blockchain infrastructure runners.
  - **Alpha Rapid-Scalp**: High-turnover volatile pairs optimized specifically for rapid 1-minute wave divergence and convergence entries.
  - **AI & Cyber Innovators**: Emerging artificial intelligence, decentralized compute, web3 infrastructure, and data-economy tokens.

### 2. Monorid Advanced Quantitative Momentum Oscillator & Dynamic Wave Engine
The trading strategy operates on mathematical principles of momentum exhaustion, harmonic wave oscillations, and macroeconomic trend confirmation:
- **Dual-Wave Convergence Algorithm**: Computes continuous fast momentum wave ($wt_1$) and smoothed harmonic trend wave ($wt_2$) across custom channel and smoothing periods.
- **Oversold Reversal Trigger (LONG)**: A bullish convergence occurs when the fast oscillator crosses upward above the slow oscillator deep within statistical oversold territory ($\le -53$).
- **Overbought Reversal Trigger (SHORT)**: A bearish convergence occurs when the fast oscillator crosses downward below the slow oscillator deep within statistical overbought territory ($\ge +53$).
- **200 EMA Macro Trend Filter**: Long positions are exclusively permitted when current market price trades strictly above the 200-period Exponential Moving Average ($Price > EMA_{200}$). Short positions are strictly restricted to regimes where price trades below the 200 EMA ($Price < EMA_{200}$).
- **Exclusivity Rule**: Any market bar not meeting these exact multi-factor criteria is strictly marked as `HOLD`.

### 3. Precision Automated Risk Management (1:2 R:R & EMA 200 Stop-Loss)
- **Stop-Loss Calibration**: For Long entries, Stop-Loss is algorithmically anchored strictly below the 200 EMA with an adaptive safety buffer ($\Delta = 0.3\%$). For Short entries, Stop-Loss is anchored strictly above the 200 EMA plus buffer.
- **Take-Profit Target (1:2 R:R)**: Take-profit is strictly locked at a mathematical 1:2 Risk-to-Reward ratio ($R:R = 2.0$), ensuring long-term positive expectancy across all executed trades.
- **100% Full Target Exit**: Positions achieve complete execution closure at the 1:2 TP price level, locking in realized capital without lingering tail risk.

### 4. Automatic Exchange Order Cleanup on Position Closure
- **Zero Orphaned Orders**: When a trade closes on Take Profit or Stop Loss, Monorid automatically broadcasts batch cancellation requests to MEXC (`/api/v1/private/order/cancel_all`, `/api/v1/private/planorder/cancel_all`, `/api/v1/private/stoporder/cancel_all`).
- Eliminates leftover trigger, plan, or limit orders from remaining active on the exchange, protecting account capital from accidental duplicate fills.

### 5. Strict Premature Exit Immunity & Zero-Close Protection
- **Ironclad Trade Lifecycle**: Positions are strictly immune from noise, synthetic drops, or API sync drops. A trade can **ONLY** close if the market price or confirmed exchange fill reaches the verified Take Profit (1:2 Target) or Stop Loss (200 EMA + 0.3% buffer).
- **Defensive Ticker Guards**: Real-time WebSocket tick filters reject zero-price, negative, or anomalous flash ticks, preventing phantom Stop Loss triggers.
- **Session Continuity**: API communication glitches during exchange reconciliation never falsely close or discard active portfolio positions.

### 6. Interactive Cybernetic Bot Constellation UI (All 8 Fleet Units Animated)
- **Full Fleet Visibility**: All 8 official Monorid bot units are continuously visible and animated in the dashboard orbital hub.
- **Dynamic Orbital Telemetry**: Features real-time SVG laser conduits, pulsing energy particles, rotating radar sweepers, and glowing halo badges.
- **Live Operational States**: Visualizes each bot's real-time mode—`HOLDING` (active position badge, leverage, and glowing green pulse) or `SCAN 1M` (hunting multi-factor convergence across its assigned sector).

### 7. Strict $0.70 USDT Minimum Balance Safety Gate
To prevent margin liquidation cascading and sub-minimum order failures on MEXC:
- Monorid enforces a strict balance constraint of **`MIN_AVAILABLE_BALANCE_USDT = 0.70`**.
- Both the client interface and the server-side order dispatch route validate available margin before emitting any execution call.
- If available wallet balance drops below $0.70 USDT, the engine automatically engages a safe state: execution locks and warning badges display `< $0.70 Blocked` until equity is replenished.

### 8. Institutional Net PnL, Fee & Funding Rate Accounting
Unlike retail bots that display naive gross profit, Monorid tracks the complete economic reality of perpetual futures:
- **Exchange Fee Extraction**: Automatically records and attributes both Maker and Taker execution fees (`totalFee`, `openFee`, `closeFee`).
- **Funding Rate Reconciliation**: Captures positive and negative funding cash flows accrued during position lifecycles.
- **Exact Net Realized PnL**: Integrates closed position history directly from exchange settlement records, ensuring 100% mathematical auditability against the broker ledger.

### 9. Persistent Server-Side Trade History & Audit Storage
- Persistent file-backed JSON storage engine (`/api/storage/trades` and `/api/storage/logs`) with atomic file writes and mutex queue concurrency.
- Full automatic client hydration on page load so trade history and audit logs are permanently preserved across refreshes, tab reloads, and multi-device access.
- One-click JSON export buttons to download complete trade histories and audit telemetry records.

### 10. Real-Time Telegram Alerting Pipeline
Direct integration with the Telegram Bot API emits rich, structured HTML trade intelligence:
- **Entry Confirmations**: Dispatches symbol, direction, entry price, leverage, stop-loss, and 1:2 take-profit targets.
- **Take-Profit & Stop-Loss Alerts**: Dispatches execution notifications with net realized PnL and exit prices.
- **Safety & Diagnostic Notifications**: Dispatches balance safety gate warnings, connection heartbeats, and emergency flatten logs.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js 15](https://nextjs.org/) (App Router, Server & Client Components) |
| **UI Library** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) |
| **Motion & Visuals** | [Motion (Framer Motion v12)](https://motion.dev/), [Lucide React](https://lucide.dev/) |
| **Programming Language** | [TypeScript 5.9](https://www.typescriptlang.org/) (Strict type-checking) |
| **Exchange API** | MEXC Contract REST API v1 (HMAC-SHA256 authenticated) + WebSocket Feed |
| **Containerization** | [Docker](https://www.docker.com/) (Multi-stage lightweight Node 20 Alpine) |
| **Cloud Runtime** | [Aiven Runtime](https://aiven.io/) / Cloud Run / Self-Hosted VPS |

---

## Directory Structure

```
Monorid/
├── app/
│   ├── api/
│   │   ├── mexc/
│   │   │   ├── balance/route.ts       # Live futures account equity & balance endpoint
│   │   │   ├── order/route.ts         # Server-side signed order placement & $0.70 gate
│   │   │   └── test-auth/route.ts     # API key/secret validation check
│   │   └── telegram/route.ts          # Telegram webhook & telemetry notification pipeline
│   ├── globals.css                    # Tailwind CSS v4 styling rules & theme tokens
│   ├── layout.tsx                     # Master HTML layout and metadata header
│   └── page.tsx                       # Main Monorid trading cockpit & central state engine
├── components/
│   ├── BotConstellation.tsx           # Multi-agent bot constellation hub & visual telemetry
│   ├── CandleChartModal.tsx           # High-resolution candlestick & wave oscillator modal
│   ├── Header.tsx                     # Header with real-time equity, IP, and status indicators
│   ├── MarketScanner.tsx              # 90-contract market scanner categorized by 6 tiers
│   ├── MiroStyleLogo.tsx              # Cybernetic vector branding logo
│   ├── MotionGraphicsLogoModal.tsx    # Interactive architectural & constellation visualizer
│   ├── PerformanceSummaryCard.tsx     # Win rate, profit factor, and cumulative PnL metrics
│   ├── PositionsView.tsx              # Live positions & closed trade auditor table
│   ├── RiskOverviewCard.tsx           # Margin utilization, safety gate, and risk gauges
│   ├── SettingsModal.tsx              # API credentials & strategy configuration modal
│   ├── TradeLogsView.tsx              # Color-coded execution event log stream
│   └── TradingSignalCard.tsx          # Real-time asset signal card with quick-action triggers
├── lib/
│   ├── mexc.ts                        # MEXC Contract API client, signatures & tiering engine
│   ├── mexc-ws.ts                     # Real-time WebSocket manager for MEXC futures edge
│   ├── strategy.ts                    # Algorithmic precision wave oscillator & 200 EMA core
│   └── utils.ts                       # Class name merging & utility helpers
├── public/                            # Static assets, branding graphics, and icons
├── Dockerfile                         # Production multi-stage Alpine container configuration
├── compose.yaml                       # Docker Compose orchestration descriptor
├── package.json                       # Project dependencies and script declarations
├── tsconfig.json                      # TypeScript compiler options
└── README.md                          # Comprehensive project documentation
```

---

## Getting Started & Installation

### Prerequisites
- **Node.js**: `v20.x` or higher (LTS recommended)
- **Package Manager**: `npm` v10+ or `yarn` / `pnpm`
- **MEXC Futures Account**: With API Key and Secret enabled for Contract trading (read + trade permissions).
- **Telegram Bot** *(Optional but recommended)*: Bot token created via [@BotFather](https://t.me/BotFather) and your chat ID.

### 1. Clone the Repository
```bash
git clone https://github.com/badalworld/Monorid.git
cd Monorid
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a local `.env.local` configuration file in the project root:
```bash
cp .env.example .env.local
```

Populate `.env.local` with your credentials:
```env
# MEXC Futures API Credentials
MEXC_API_KEY="your_mexc_api_key_here"
MEXC_SECRET_KEY="your_mexc_api_secret_here"

# Telegram Real-Time Notification Pipeline (Optional)
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"

# Application Hosting Configuration
APP_URL="http://localhost:3000"
PORT=3000
```

> **Security Notice**: Never commit your actual API keys or secrets to version control. Keys can also be entered interactively via the **Settings Modal** in the UI, where they remain encrypted in client-side secure local storage.

### 4. Run in Development Mode
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to launch the Monorid terminal.

### 5. Build for Production
```bash
npm run build
npm run start
```

---

## Production Deployment

### Option A: Docker Containerization
Monorid includes an optimized, multi-stage `Dockerfile` built on `node:20-alpine`:

```bash
# Build the Docker image
docker build -t monorid-quant:latest .

# Run the container
docker run -d \
  --name monorid \
  -p 3000:3000 \
  -e MEXC_API_KEY="your_mexc_api_key" \
  -e MEXC_SECRET_KEY="your_mexc_secret_key" \
  -e TELEGRAM_BOT_TOKEN="your_bot_token" \
  -e TELEGRAM_CHAT_ID="your_chat_id" \
  --restart unless-stopped \
  monorid-quant:latest
```

Alternatively, launch using Docker Compose:
```bash
docker compose up -d
```

### Option B: Aiven Runtime / Cloud Deployment
1. Set the runtime target to Node.js 20.
2. Build command: `npm ci && npm run build`
3. Start command: `node server.js` (from `.next/standalone`) or `npm run start`
4. Bind port: `3000`
5. Inject environment variables: `MEXC_API_KEY`, `MEXC_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

---

## Algorithmic Trading Rules & Configuration

| Parameter | Default Value | Quant Description |
| :--- | :--- | :--- |
| `channelLength` | `10` | Sampling channel length for primary wave momentum calculations. |
| `averageLength` | `21` | Exponential moving average smoothing period for wave inertia. |
| `obLevel1` | `60` | Primary extreme overbought statistical boundary. |
| `obLevel2` | `53` | Secondary overbought convergence threshold (trigger zone). |
| `osLevel1` | `-60` | Primary extreme oversold statistical boundary. |
| `osLevel2` | `-53` | Secondary oversold convergence threshold (trigger zone). |
| `emaLength` | `200` | Macro trend regime filter period (200 Exponential Moving Average). |
| `riskRewardRatio` | `2.0` | Fixed mathematical Take-Profit target ratio (1:2 R:R). |
| `slBufferPct` | `0.003` | Safety buffer percentage placed beyond the 200 EMA (0.3%). |
| `minAvailableBalance` | `$0.70` | Mandatory pre-flight equity safety gate in USDT. |
| `equityRiskPct` | `10%` | Maximum portfolio risk allocated per executed scalp contract. |
| `defaultLeverage` | `7x` | Default algorithmic leverage applied to perpetual contracts. |

---

## Risk Disclaimer

Cryptocurrency perpetual futures trading involves substantial financial risk, market volatility, and the potential for capital loss. Monorid is an automated quantitative software tool engineered for algorithmic execution. Past performance, backtest simulations, and signal metrics are not guarantees of future profits. Always deploy prudent capital allocation and conduct extensive testing before trading live capital.

---

## License & Copyright

**Copyright and developed by Trading Lifestyle Quant**

All rights reserved. Unauthorized reproduction, modification, or distribution of this software without explicit permission is strictly prohibited.
