const fs = require('fs');

const raw = fs.readFileSync('all_historical_orders.json', 'utf8');
const orders = JSON.parse(raw);

// Group orders by positionId or pair open/close
const positions = {};
const closes = [];

orders.forEach(o => {
  if (o.side === 2 || o.side === 4) {
    closes.push(o);
  }
});

console.log(`Analyzing ${closes.length} closing trades...`);

let wins = [];
let losses = [];
let fees = [];
let durations = [];
let pnls = [];
let pnlRates = [];
let leverageDist = {};

// Match closing orders with open orders if possible using positionId
const openMap = new Map();
orders.forEach(o => {
  if (o.side === 1 || o.side === 3) {
    openMap.set(o.positionId, o);
  }
});

closes.forEach(c => {
  const pnl = Number(c.profit) || 0;
  const pnlRate = Number(c.pnlRate) || 0;
  const fee = (Number(c.takerFee) || 0) + (Number(c.makerFee) || 0);
  const lev = c.leverage || 10;
  leverageDist[lev] = (leverageDist[lev] || 0) + 1;

  pnls.push(pnl);
  pnlRates.push(pnlRate);
  fees.push(fee);

  const openOrder = openMap.get(c.positionId);
  if (openOrder && c.createTime && openOrder.createTime) {
    const durMs = c.createTime - openOrder.createTime;
    durations.push(durMs / 1000); // seconds
  }

  if (pnl > 0.0001) {
    wins.push({ pnl, pnlRate, fee, symbol: c.symbol, lev, isPlan: (c.externalOid || '').includes('planorder') });
  } else if (pnl < -0.0001) {
    losses.push({ pnl, pnlRate, fee, symbol: c.symbol, lev, isPlan: (c.externalOid || '').includes('planorder') });
  }
});

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const median = arr => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

console.log('=== DETAILED TRADE STATISTICS ===');
console.log(`Total Wins: ${wins.length}`);
console.log(`Average Win: $${avg(wins.map(w => w.pnl)).toFixed(4)}`);
console.log(`Median Win: $${median(wins.map(w => w.pnl)).toFixed(4)}`);
console.log(`Average Win PnL Rate: ${(avg(wins.map(w => w.pnlRate)) * 100).toFixed(2)}%`);

console.log(`\nTotal Losses: ${losses.length}`);
console.log(`Average Loss: $${avg(losses.map(l => l.pnl)).toFixed(4)}`);
console.log(`Median Loss: $${median(losses.map(l => l.pnl)).toFixed(4)}`);
console.log(`Average Loss PnL Rate: ${(avg(losses.map(l => l.pnlRate)) * 100).toFixed(2)}%`);

console.log(`\nWin/Loss Ratio (Avg Win / Avg Loss): ${(Math.abs(avg(wins.map(w => w.pnl)) / avg(losses.map(l => l.pnl)))).toFixed(2)}`);

console.log('\n=== HOLDING DURATION ===');
if (durations.length) {
  console.log(`Matched Positions: ${durations.length}`);
  console.log(`Average Duration: ${(avg(durations) / 60).toFixed(1)} minutes`);
  console.log(`Median Duration: ${(median(durations) / 60).toFixed(1)} minutes`);
  console.log(`Min Duration: ${Math.min(...durations).toFixed(0)}s, Max: ${(Math.max(...durations) / 3600).toFixed(1)}h`);
}

console.log('\n=== LEVERAGE DISTRIBUTION ===');
console.dir(leverageDist);

console.log('\n=== PLAN ORDER (TP/SL) VS IMMEDIATE MARKET EXITS ===');
const planWins = wins.filter(w => w.isPlan);
const planLosses = losses.filter(l => l.isPlan);
console.log(`Plan Order Wins: ${planWins.length}, Avg: $${avg(planWins.map(w => w.pnl)).toFixed(4)}`);
console.log(`Plan Order Losses: ${planLosses.length}, Avg: $${avg(planLosses.map(l => l.pnl)).toFixed(4)}`);
if (planLosses.length) {
  console.log(`Plan Order Avg Win / Avg Loss: ${(Math.abs(avg(planWins.map(w => w.pnl)) / avg(planLosses.map(l => l.pnl)))).toFixed(2)}`);
}

const marketWins = wins.filter(w => !w.isPlan);
const marketLosses = losses.filter(l => !l.isPlan);
console.log(`Market Order Wins: ${marketWins.length}, Avg: $${avg(marketWins.map(w => w.pnl)).toFixed(4)}`);
console.log(`Market Order Losses: ${marketLosses.length}, Avg: $${avg(marketLosses.map(l => l.pnl)).toFixed(4)}`);
if (marketLosses.length) {
  console.log(`Market Order Avg Win / Avg Loss: ${(Math.abs(avg(marketWins.map(w => w.pnl)) / avg(marketLosses.map(l => l.pnl)))).toFixed(2)}`);
}

// Fee impact analysis
console.log('\n=== FEE ANALYSIS ===');
const avgFeePerTrade = avg(fees);
console.log(`Average Fee per Closing Trade: $${avgFeePerTrade.toFixed(4)}`);
console.log(`Fee as % of Average Win: ${((avgFeePerTrade / avg(wins.map(w => w.pnl))) * 100).toFixed(1)}%`);
console.log(`Fee as % of Average Loss: ${((avgFeePerTrade / Math.abs(avg(losses.map(l => l.pnl)))) * 100).toFixed(1)}%`);
