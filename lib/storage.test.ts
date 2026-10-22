import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  getStorageDir,
  getTradesFilePath,
  getLogsFilePath,
  getStoredTrades,
  saveStoredTrades,
  appendStoredTrades,
  clearStoredTrades,
  getStoredLogs,
  appendStoredLogs,
  clearStoredLogs,
  MAX_STORED_LOGS,
} from './storage.ts';
import type { MexcPosition, TradeLog } from './mexc.ts';

test('getStorageDir returns a valid writable directory', () => {
  const dir = getStorageDir();
  assert.ok(typeof dir === 'string' && dir.length > 0, 'Directory path must be valid');
  assert.ok(fs.existsSync(dir), 'Storage directory must exist on disk');
});

test('Trade storage: append, get, save, and clear operations', async () => {
  // Clear any existing test data
  await clearStoredTrades();
  const initial = await getStoredTrades();
  assert.deepEqual(initial, [], 'Initial trade storage must be empty after clear');

  const trade1: MexcPosition = {
    id: 'mexc-90001',
    orderId: '90001',
    positionId: 101,
    symbol: 'BTC_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'LONG',
    entryPrice: 90000,
    currentPrice: 92700,
    exitPrice: 92700,
    leverage: 7,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 88650,
    tp1Price: 92700,
    tp2Price: 92700,
    tp3Price: 92700,
    tp1Hit: true,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 2.1,
    realizedPnlPct: 21.0,
    fee: 0.015,
    fundingFee: 0,
    netRealizedPnl: 2.085,
    status: 'CLOSED',
    createdAt: 1700000000000,
    closedAt: 1700000600000,
    closeReason: 'TP1',
  };

  const trade2: MexcPosition = {
    id: 'mexc-90002',
    orderId: '90002',
    positionId: 102,
    symbol: 'ETH_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'SHORT',
    entryPrice: 3000,
    currentPrice: 2950,
    exitPrice: 2950,
    leverage: 7,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 3045,
    tp1Price: 2910,
    tp2Price: 2910,
    tp3Price: 2910,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 1.16,
    realizedPnlPct: 11.6,
    fee: 0.01,
    fundingFee: 0.002,
    netRealizedPnl: 1.152,
    status: 'CLOSED',
    createdAt: 1700001000000,
    closedAt: 1700001800000,
    closeReason: 'MANUAL',
  };

  // Append trade1
  const afterAppend1 = await appendStoredTrades(trade1);
  assert.equal(afterAppend1.length, 1);
  assert.equal(afterAppend1[0].symbol, 'BTC_USDT');

  // Append trade2
  const afterAppend2 = await appendStoredTrades([trade2]);
  assert.equal(afterAppend2.length, 2);

  // Append duplicate of trade1 (same orderId) -> must deduplicate without duplicating count
  const afterDup = await appendStoredTrades({ ...trade1 });
  assert.equal(afterDup.length, 2, 'Duplicate orderId must be merged/deduplicated');

  // Verify file on disk
  const fromDisk = await getStoredTrades();
  assert.equal(fromDisk.length, 2);

  // Clear trades
  await clearStoredTrades();
  const cleared = await getStoredTrades();
  assert.equal(cleared.length, 0);
});

test('Log storage: append, deduplicate, limit, and clear operations', async () => {
  await clearStoredLogs();
  const initial = await getStoredLogs();
  assert.deepEqual(initial, [], 'Initial log storage must be empty after clear');

  const log1: TradeLog = {
    id: 'log-001',
    timestamp: 1700000100000,
    groupName: 'SYSTEM',
    symbol: 'AUTOTRADE',
    type: 'MONORID_RUNNING',
    side: 'INFO',
    price: 0,
    message: 'Monorid Running: Autonomous trading active',
  };

  const log2: TradeLog = {
    id: 'log-002',
    timestamp: 1700000200000,
    groupName: 'Apex Cyber-Volatiles',
    symbol: 'BTC_USDT',
    type: 'NEW_OPPORTUNITY',
    side: 'LONG',
    price: 90000,
    message: 'New Opportunity: BTC_USDT (LONG)',
  };

  const log3: TradeLog = {
    id: 'log-003',
    timestamp: 1700000300000,
    groupName: 'Apex Cyber-Volatiles',
    symbol: 'BTC_USDT',
    type: 'TP_HIT',
    side: 'LONG',
    price: 92700,
    pnl: 2.1,
    fee: 0.015,
    netPnl: 2.085,
    message: 'Take Profit 1:2 Hit: BTC_USDT closed',
  };

  // Append single log
  const res1 = await appendStoredLogs(log1);
  assert.equal(res1.count, 1);

  // Append batch of logs
  const res2 = await appendStoredLogs([log2, log3]);
  assert.equal(res2.count, 3);

  // Verify newest-first order
  const logs = await getStoredLogs();
  assert.equal(logs.length, 3);
  assert.equal(logs[0].id, 'log-003', 'Newest log must be first in list');
  assert.equal(logs[2].id, 'log-001', 'Oldest log must be last in list');

  // Test limit parameter
  const limited = await getStoredLogs(2);
  assert.equal(limited.length, 2);
  assert.equal(limited[0].id, 'log-003');
  assert.equal(limited[1].id, 'log-002');

  // Duplicate ID append -> should be ignored
  const resDup = await appendStoredLogs(log2);
  assert.equal(resDup.count, 3, 'Duplicate log ID must not create new entry');

  // Clear logs
  await clearStoredLogs();
  const cleared = await getStoredLogs();
  assert.equal(cleared.length, 0);
});

test('Concurrent storage operations: serialized safely by mutex queue', async () => {
  await clearStoredLogs();

  // Launch 15 parallel append calls
  const promises = [];
  for (let i = 0; i < 15; i++) {
    const log: TradeLog = {
      id: `parallel-log-${i}`,
      timestamp: 1700000000000 + i * 1000,
      groupName: 'SYSTEM',
      symbol: `TEST_${i}`,
      type: 'MARKET_SCAN',
      side: 'INFO',
      price: i * 10,
      message: `Parallel log item #${i}`,
    };
    promises.push(appendStoredLogs(log));
  }

  await Promise.all(promises);
  const allLogs = await getStoredLogs();
  assert.equal(allLogs.length, 15, 'All 15 parallel logs must be persisted without race condition data loss');

  await clearStoredLogs();
});

test('Resilience: handles empty or corrupted JSON gracefully without crashing', async () => {
  const tradesFile = getTradesFilePath();
  // Write invalid corrupted JSON
  fs.writeFileSync(tradesFile, '{ corrupted JSON @@## invalid syntax', 'utf8');

  // getStoredTrades must safely return empty array
  const trades = await getStoredTrades();
  assert.deepEqual(trades, [], 'Corrupted JSON must safely fallback to empty array');

  // Saving again should restore valid JSON
  await saveStoredTrades([]);
  const valid = await getStoredTrades();
  assert.deepEqual(valid, []);
});
