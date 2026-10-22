const fs = require('fs');
const path = require('path');

async function fetchPage(pageNum) {
  const res = await fetch('http://localhost:3000/api/mexc/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'history_orders',
      page_num: pageNum,
      page_size: 100
    })
  });
  const json = await res.json();
  return json.data || [];
}

async function main() {
  console.log('Fetching all historical orders from MEXC...');
  let allOrders = [];
  let page = 1;
  while (true) {
    console.log(`Fetching page ${page}...`);
    try {
      const orders = await fetchPage(page);
      if (!orders || orders.length === 0) break;
      allOrders.push(...orders);
      console.log(`Page ${page}: got ${orders.length} orders (total: ${allOrders.length})`);
      if (orders.length < 100) break;
      page++;
      // safety limit
      if (page > 30) break;
    } catch (err) {
      console.error(`Error on page ${page}:`, err.message);
      break;
    }
  }

  console.log(`Total orders fetched: ${allOrders.length}`);
  fs.writeFileSync('all_historical_orders.json', JSON.stringify(allOrders, null, 2));

  // Filter closing orders (side 2 = close short, side 4 = close long)
  // or orders that have profit != 0 or state == 3 (completed) with dealVol > 0
  const closingOrders = allOrders.filter(o => o.side === 2 || o.side === 4);
  console.log(`Total closing orders: ${closingOrders.length}`);

  let totalProfit = 0;
  let totalFee = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakEvenCount = 0;
  let grossWin = 0;
  let grossLoss = 0;

  const symbolStats = {};
  const reasonStats = {};

  closingOrders.forEach(o => {
    const pnl = Number(o.profit) || 0;
    const fee = (Number(o.takerFee) || 0) + (Number(o.makerFee) || 0);
    const netPnl = pnl - fee;
    const symbol = o.symbol;
    const isPlanOrder = (o.externalOid || '').includes('planorder');

    totalProfit += pnl;
    totalFee += fee;

    if (pnl > 0.0001) {
      winCount++;
      grossWin += pnl;
    } else if (pnl < -0.0001) {
      lossCount++;
      grossLoss += Math.abs(pnl);
    } else {
      breakEvenCount++;
    }

    if (!symbolStats[symbol]) {
      symbolStats[symbol] = { wins: 0, losses: 0, profit: 0, fee: 0, count: 0 };
    }
    symbolStats[symbol].count++;
    symbolStats[symbol].profit += pnl;
    symbolStats[symbol].fee += fee;
    if (pnl > 0.0001) symbolStats[symbol].wins++;
    else if (pnl < -0.0001) symbolStats[symbol].losses++;

    const typeKey = isPlanOrder ? 'TP_SL_TRIGGER' : 'MARKET_OR_MANUAL';
    if (!reasonStats[typeKey]) reasonStats[typeKey] = { wins: 0, losses: 0, pnl: 0, count: 0 };
    reasonStats[typeKey].count++;
    reasonStats[typeKey].pnl += pnl;
    if (pnl > 0.0001) reasonStats[typeKey].wins++;
    else if (pnl < -0.0001) reasonStats[typeKey].losses++;
  });

  const totalTrades = winCount + lossCount + breakEvenCount;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  console.log('\n--- PERFORMANCE SUMMARY ---');
  console.log(`Total Trades Analyzed: ${totalTrades}`);
  console.log(`Wins: ${winCount} (${winRate.toFixed(1)}%)`);
  console.log(`Losses: ${lossCount} (${(totalTrades > 0 ? (lossCount / totalTrades) * 100 : 0).toFixed(1)}%)`);
  console.log(`Breakeven: ${breakEvenCount}`);
  console.log(`Gross Win: $${grossWin.toFixed(4)}`);
  console.log(`Gross Loss: $${grossLoss.toFixed(4)}`);
  console.log(`Gross PnL: $${totalProfit.toFixed(4)}`);
  console.log(`Total Fees Paid: $${totalFee.toFixed(4)}`);
  console.log(`Net PnL (after fees): $${(totalProfit - totalFee).toFixed(4)}`);
  console.log(`Profit Factor: ${profitFactor.toFixed(2)}`);

  console.log('\n--- BY EXIT MECHANISM ---');
  console.dir(reasonStats, { depth: null });

  console.log('\n--- TOP 10 BEST SYMBOLS ---');
  const sortedSymbols = Object.entries(symbolStats).sort((a, b) => b[1].profit - a[1].profit);
  console.dir(sortedSymbols.slice(0, 10));

  console.log('\n--- TOP 10 WORST SYMBOLS ---');
  console.dir(sortedSymbols.slice(-10));
}

main().catch(console.error);
