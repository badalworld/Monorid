const fs = require('fs');

const orders = JSON.parse(fs.readFileSync('all_historical_orders.json', 'utf8'));

// Filter closing orders
const closes = orders.filter(o => o.side === 2 || o.side === 4);

console.log('=== AUDIT OF ALL TRADES EXECUTED ===');
console.log('Total closing orders:', closes.length);

// 1. Long vs Short breakdown
let longTrades = { count: 0, wins: 0, losses: 0, pnl: 0, fee: 0 };
let shortTrades = { count: 0, wins: 0, losses: 0, pnl: 0, fee: 0 };

closes.forEach(c => {
  const pnl = Number(c.profit) || 0;
  const fee = (Number(c.takerFee) || 0) + (Number(c.makerFee) || 0);
  // side 4 is close long (so position was LONG)
  // side 2 is close short (so position was SHORT)
  const isLong = c.side === 4;
  const target = isLong ? longTrades : shortTrades;
  target.count++;
  target.pnl += pnl;
  target.fee += fee;
  if (pnl > 0.0001) target.wins++;
  else if (pnl < -0.0001) target.losses++;
});

console.log('\n--- 1. LONG VS SHORT BREAKDOWN ---');
console.log(`LONG Trades: ${longTrades.count} | Wins: ${longTrades.wins} (${((longTrades.wins/longTrades.count)*100).toFixed(1)}%) | PnL: $${longTrades.pnl.toFixed(4)} | Fees: $${longTrades.fee.toFixed(4)} | Net: $${(longTrades.pnl - longTrades.fee).toFixed(4)}`);
console.log(`SHORT Trades: ${shortTrades.count} | Wins: ${shortTrades.wins} (${((shortTrades.wins/shortTrades.count)*100).toFixed(1)}%) | PnL: $${shortTrades.pnl.toFixed(4)} | Fees: $${shortTrades.fee.toFixed(4)} | Net: $${(shortTrades.pnl - shortTrades.fee).toFixed(4)}`);

// 2. Hourly breakdown (UTC)
const hourly = Array.from({ length: 24 }, () => ({ count: 0, wins: 0, losses: 0, pnl: 0, fee: 0 }));
closes.forEach(c => {
  const pnl = Number(c.profit) || 0;
  const fee = (Number(c.takerFee) || 0) + (Number(c.makerFee) || 0);
  const hour = new Date(c.createTime).getUTCHours();
  hourly[hour].count++;
  hourly[hour].pnl += pnl;
  hourly[hour].fee += fee;
  if (pnl > 0.0001) hourly[hour].wins++;
  else if (pnl < -0.0001) hourly[hour].losses++;
});

console.log('\n--- 2. HOURLY BREAKDOWN (UTC) ---');
hourly.forEach((h, i) => {
  if (h.count > 0) {
    const wr = ((h.wins / h.count) * 100).toFixed(1);
    console.log(`UTC ${i.toString().padStart(2, '0')}:00 - Trades: ${h.count.toString().padStart(3)} | WR: ${wr}% | Net: $${(h.pnl - h.fee).toFixed(3)}`);
  }
});

// 3. Trade Distribution by Holding Duration
const openMap = new Map();
orders.forEach(o => {
  if (o.side === 1 || o.side === 3) openMap.set(o.positionId, o);
});

const durationBuckets = [
  { name: '< 5 mins', max: 300, count: 0, wins: 0, pnl: 0, fee: 0 },
  { name: '5 - 15 mins', max: 900, count: 0, wins: 0, pnl: 0, fee: 0 },
  { name: '15 - 30 mins', max: 1800, count: 0, wins: 0, pnl: 0, fee: 0 },
  { name: '30 - 60 mins', max: 3600, count: 0, wins: 0, pnl: 0, fee: 0 },
  { name: '1 - 3 hours', max: 10800, count: 0, wins: 0, pnl: 0, fee: 0 },
  { name: '> 3 hours', max: Infinity, count: 0, wins: 0, pnl: 0, fee: 0 },
];

closes.forEach(c => {
  const openOrder = openMap.get(c.positionId);
  if (!openOrder || !c.createTime || !openOrder.createTime) return;
  const durSec = (c.createTime - openOrder.createTime) / 1000;
  const pnl = Number(c.profit) || 0;
  const fee = (Number(c.takerFee) || 0) + (Number(c.makerFee) || 0);

  for (const b of durationBuckets) {
    if (durSec <= b.max) {
      b.count++;
      b.pnl += pnl;
      b.fee += fee;
      if (pnl > 0.0001) b.wins++;
      break;
    }
  }
});

console.log('\n--- 3. PROFITABILITY BY HOLDING DURATION ---');
durationBuckets.forEach(b => {
  const wr = b.count > 0 ? ((b.wins / b.count) * 100).toFixed(1) : '0';
  console.log(`${b.name.padEnd(14)}: ${b.count.toString().padStart(3)} trades | WR: ${wr}% | Net: $${(b.pnl - b.fee).toFixed(3)}`);
});

// 4. Worst Losing Streaks & Symbols with Low Liquidity
const symStats = {};
closes.forEach(c => {
  const s = c.symbol;
  const pnl = Number(c.profit) || 0;
  const fee = (Number(c.takerFee) || 0) + (Number(c.makerFee) || 0);
  if (!symStats[s]) symStats[s] = { count: 0, wins: 0, losses: 0, pnl: 0, fee: 0 };
  symStats[s].count++;
  symStats[s].pnl += pnl;
  symStats[s].fee += fee;
  if (pnl > 0.0001) symStats[s].wins++;
  else if (pnl < -0.0001) symStats[s].losses++;
});

console.log('\n--- 4. SYMBOLS WITH NEGATIVE NET PNL (< -$0.50) ---');
const worst = Object.entries(symStats)
  .map(([s, d]) => ({ symbol: s, ...d, net: d.pnl - d.fee }))
  .filter(d => d.net < -0.5)
  .sort((a, b) => a.net - b.net);
worst.forEach(w => {
  console.log(`${w.symbol.padEnd(16)} | Trades: ${w.count.toString().padStart(2)} | Wins: ${w.wins} | Losses: ${w.losses} | Gross PnL: $${w.pnl.toFixed(3)} | Fees: $${w.fee.toFixed(3)} | Net: $${w.net.toFixed(3)}`);
});
