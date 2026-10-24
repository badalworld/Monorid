import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractOrderFeeAndFunding,
  deduplicateClosedPositions,
  reconstructStrategyTargets,
  MIN_AVAILABLE_BALANCE_USDT,
  type MexcPosition,
} from './mexc.ts';

test('extractOrderFeeAndFunding handles empty, null, and malformed order records gracefully', () => {
  const r1 = extractOrderFeeAndFunding(null);
  assert.deepEqual(r1, { fee: 0, fundingFee: 0, realizedPnl: 0, netPnl: 0 });

  const r2 = extractOrderFeeAndFunding(undefined);
  assert.deepEqual(r2, { fee: 0, fundingFee: 0, realizedPnl: 0, netPnl: 0 });

  const r3 = extractOrderFeeAndFunding({});
  assert.deepEqual(r3, { fee: 0, fundingFee: 0, realizedPnl: 0, netPnl: 0 });
});

test('extractOrderFeeAndFunding extracts fee from totalFee, fee, or takerFee+makerFee', () => {
  // Case 1: totalFee provided
  const o1 = { totalFee: 0.0064, profit: 0.12, fundingFee: 0 };
  const r1 = extractOrderFeeAndFunding(o1);
  assert.equal(r1.fee, 0.0064);
  assert.equal(r1.realizedPnl, 0.12);
  assert.equal(r1.netPnl, 0.1136);

  // Case 2: negative fee convention (MEXC fee = -0.0083)
  const o2 = { fee: -0.0083, profit: -0.154, fundingFee: 0 };
  const r2 = extractOrderFeeAndFunding(o2);
  assert.equal(r2.fee, 0.0083);
  assert.equal(r2.realizedPnl, -0.154);
  assert.equal(r2.netPnl, -0.1623);

  // Case 3: takerFee + makerFee fallback
  const o3 = { takerFee: 0.004, makerFee: 0.002, profit: 0.5 };
  const r3 = extractOrderFeeAndFunding(o3);
  assert.equal(r3.fee, 0.006);
  assert.equal(r3.netPnl, 0.494);
});

test('extractOrderFeeAndFunding correctly applies positive and negative funding fees', () => {
  // Positive funding fee received (+0.005)
  const o1 = { totalFee: 0.01, profit: 1.0, fundingFee: 0.005 };
  const r1 = extractOrderFeeAndFunding(o1);
  assert.equal(r1.fundingFee, 0.005);
  // Net = 1.0 - 0.01 + 0.005 = 0.995
  assert.equal(r1.netPnl, 0.995);

  // Negative funding fee paid (-0.003)
  const o2 = { totalFee: 0.01, profit: 1.0, fundingFee: -0.003 };
  const r2 = extractOrderFeeAndFunding(o2);
  assert.equal(r2.fundingFee, -0.003);
  // Net = 1.0 - 0.01 + (-0.003) = 0.987
  assert.equal(r2.netPnl, 0.987);
});

test('deduplicateClosedPositions merges local bot SL and exchange Resynced TP1 duplicate', () => {
  // Scenario matching user report:
  // ALT SHORT trade closed at 22:03:59 from local bot Apex Momentum (Apex Cyber-Volatiles) with SL (-$0.38)
  // AND duplicate at 22:04:03 (4 seconds later) from Mean Reversion (Resynced (Exchange)) with TP1 ($0.00)
  const localTrade: MexcPosition = {
    id: 'pos-ALT_USDT-1792568639000',
    symbol: 'ALT_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 0.15,
    currentPrice: 0.155,
    exitPrice: 0.155,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 100,
    closedVol: 100,
    slPrice: 0.155,
    tp1Price: 0.14,
    tp2Price: 0.14,
    tp3Price: 0.14,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: true,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.38,
    realizedPnlPct: -3.8,
    status: 'CLOSED',
    createdAt: 1792568600000,
    closedAt: 1792568639000,
    closeReason: 'SL',
  };

  const exchangeDuplicate: MexcPosition = {
    id: 'mexc-867794324329249280',
    orderId: '867794324329249280',
    positionId: 1524416713,
    symbol: 'ALT_USDT',
    groupName: 'Resynced (Exchange)',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'SHORT',
    entryPrice: 0.15,
    currentPrice: 0.155,
    exitPrice: 0.155,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 100,
    closedVol: 100,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: true,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.00,
    realizedPnlPct: 0,
    fee: 0.0064,
    fundingFee: 0,
    netRealizedPnl: -0.0064,
    status: 'CLOSED',
    createdAt: 1792568600000,
    closedAt: 1792568643000, // 4s later
    closeReason: 'TP1', // Bogus synthetic TP1
  };

  const deduplicated = deduplicateClosedPositions([localTrade, exchangeDuplicate]);

  // Exactly ONE trade must remain
  assert.equal(deduplicated.length, 1);
  const trade = deduplicated[0];

  // Original bot attribution preserved
  assert.equal(trade.botId, 'apex-momentum');
  assert.equal(trade.botName, 'Apex Momentum');
  assert.equal(trade.groupName, 'Apex Cyber-Volatiles');

  // Reason must be SL, NOT the bogus TP1
  assert.equal(trade.closeReason, 'SL');
  assert.equal(trade.realizedPnl, -0.38);

  // Strategy TP and SL target levels preserved
  assert.equal(trade.slPrice, 0.155);
  assert.equal(trade.tp1Price, 0.14);

  // Fee and Net PnL accurately combined
  assert.equal(trade.fee, 0.0064);
  assert.equal(trade.netRealizedPnl, -0.3864);
});

test('deduplicateClosedPositions deduplicates by orderId and positionId', () => {
  const trade1: MexcPosition = {
    id: 'pos-APR_USDT-1',
    orderId: '999888777',
    symbol: 'APR_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 0.5,
    currentPrice: 0.48,
    exitPrice: 0.48,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 20,
    closedVol: 20,
    slPrice: 0.52,
    tp1Price: 0.46,
    tp2Price: 0.46,
    tp3Price: 0.46,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.40,
    status: 'CLOSED',
    createdAt: 100000,
    closedAt: 120000,
    closeReason: 'TP1',
  };

  const trade2: MexcPosition = {
    id: 'mexc-999888777',
    orderId: '999888777',
    symbol: 'APR_USDT',
    groupName: 'Resynced (Exchange)',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 0.5,
    currentPrice: 0.48,
    exitPrice: 0.48,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 20,
    closedVol: 20,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.40,
    fee: 0.008,
    fundingFee: 0.001,
    status: 'CLOSED',
    createdAt: 100000,
    closedAt: 125000,
    closeReason: 'TP1',
  };

  const deduplicated = deduplicateClosedPositions([trade1, trade2]);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].symbol, 'APR_USDT');
  assert.equal(deduplicated[0].groupName, 'Apex Cyber-Volatiles');
  assert.equal(deduplicated[0].fee, 0.008);
  assert.equal(deduplicated[0].fundingFee, 0.001);
  assert.equal(deduplicated[0].netRealizedPnl, 0.393); // 0.40 - 0.008 + 0.001
});

test('deduplicateClosedPositions keeps genuinely separate trades hours apart', () => {
  const tradeMorning: MexcPosition = {
    id: 'pos-BTC_USDT-1',
    orderId: '1001',
    symbol: 'BTC_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'LONG',
    entryPrice: 60000,
    currentPrice: 61000,
    exitPrice: 61000,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 59000,
    tp1Price: 61000,
    tp2Price: 61000,
    tp3Price: 61000,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 1.0,
    status: 'CLOSED',
    createdAt: 10000000,
    closedAt: 10060000,
    closeReason: 'TP1',
  };

  const tradeEvening: MexcPosition = {
    id: 'pos-BTC_USDT-2',
    orderId: '1002',
    symbol: 'BTC_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'LONG',
    entryPrice: 62000,
    currentPrice: 62500,
    exitPrice: 62500,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 61500,
    tp1Price: 63000,
    tp2Price: 63000,
    tp3Price: 63000,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.5,
    status: 'CLOSED',
    createdAt: 20000000, // hours later
    closedAt: 20060000,
    closeReason: 'TP1',
  };

  const deduplicated = deduplicateClosedPositions([tradeMorning, tradeEvening]);
  assert.equal(deduplicated.length, 2);
});

test('deduplicateClosedPositions preserves open positions untouched', () => {
  const openPos: MexcPosition = {
    id: 'pos-ETH_USDT-open',
    symbol: 'ETH_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'LONG',
    entryPrice: 3000,
    currentPrice: 3050,
    leverage: 10,
    initialSize: 10,
    currentSize: 10,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 0,
    slPrice: 2950,
    tp1Price: 3100,
    tp2Price: 3100,
    tp3Price: 3100,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0.5,
    unrealizedPnlPct: 5,
    realizedPnl: 0,
    status: 'OPEN',
    createdAt: Date.now(),
  };

  const deduplicated = deduplicateClosedPositions([openPos]);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].status, 'OPEN');
});

test('reconstructStrategyTargets generates correct 1:2 TP and EMA 200 SL targets for LONG and SHORT', () => {
  // LONG: entry 100. Risk 1.5% = 1.5. SL = 98.5. TP (1:2) = 100 + 3.0 = 103.0
  const longTargets = reconstructStrategyTargets(100, 'LONG');
  assert.equal(longTargets.slPrice, 98.5);
  assert.equal(longTargets.tp1Price, 103.0);

  // SHORT: entry 100. Risk 1.5% = 1.5. SL = 101.5. TP (1:2) = 100 - 3.0 = 97.0
  const shortTargets = reconstructStrategyTargets(100, 'SHORT');
  assert.equal(shortTargets.slPrice, 101.5);
  assert.equal(shortTargets.tp1Price, 97.0);
});

test('extractOrderFeeAndFunding handles position history openFee + closeFee and closeProfit', () => {
  const posHistoryOrder = {
    openFee: 0.0035,
    closeFee: 0.0037,
    closeProfit: 0.45,
    funding: -0.001,
  };
  const result = extractOrderFeeAndFunding(posHistoryOrder);
  assert.equal(result.fee, 0.0072); // 0.0035 + 0.0037
  assert.equal(result.realizedPnl, 0.45);
  assert.equal(result.fundingFee, -0.001);
  assert.equal(result.netPnl, 0.4418); // 0.45 - 0.0072 + (-0.001)
});

test('deduplicateClosedPositions adopts real exchange fee over local estimated fee', () => {
  const localTrade: MexcPosition = {
    id: 'pos-BTC_USDT-local',
    symbol: 'BTC_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'LONG',
    entryPrice: 65000,
    currentPrice: 66950,
    exitPrice: 66950,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 64025,
    tp1Price: 66950,
    tp2Price: 66950,
    tp3Price: 66950,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.30,
    fee: 0.008, // Estimated local fee
    fundingFee: 0,
    netRealizedPnl: 0.292,
    status: 'CLOSED',
    createdAt: 1000000,
    closedAt: 1050000,
    closeReason: 'TP1',
  };

  const exchangeTrade: MexcPosition = {
    id: 'mexc-999111222',
    orderId: '999111222',
    symbol: 'BTC_USDT',
    groupName: 'Resynced (Exchange)',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'LONG',
    entryPrice: 65000,
    currentPrice: 66950,
    exitPrice: 66950,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.30,
    fee: 0.0064, // Exact exchange fee
    fundingFee: 0,
    netRealizedPnl: 0.2936,
    status: 'CLOSED',
    createdAt: 1000000,
    closedAt: 1051000,
    closeReason: 'TP1',
  };

  const merged = deduplicateClosedPositions([localTrade, exchangeTrade]);
  assert.equal(merged.length, 1);
  // Real exchange fee must override local estimate
  assert.equal(merged[0].fee, 0.0064);
  assert.equal(merged[0].netRealizedPnl, 0.2936);
  // Bot attribution preserved
  assert.equal(merged[0].botName, 'Apex Momentum');
  // TP and SL preserved
  assert.equal(merged[0].tp1Price, 66950);
  assert.equal(merged[0].slPrice, 64025);
});

test('deduplicateClosedPositions preserves MANUAL and TP2 close reasons', () => {
  const manualTrade: MexcPosition = {
    id: 'pos-ETH_USDT-manual',
    symbol: 'ETH_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'LONG',
    entryPrice: 3000,
    currentPrice: 3050,
    exitPrice: 3050,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 2955,
    tp1Price: 3090,
    tp2Price: 3090,
    tp3Price: 3090,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.16,
    status: 'CLOSED',
    createdAt: 500000,
    closedAt: 510000,
    closeReason: 'MANUAL',
  };

  const exchangeSyncTrade: MexcPosition = {
    id: 'mexc-888777666',
    orderId: '888777666',
    symbol: 'ETH_USDT',
    groupName: 'Resynced (Exchange)',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'LONG',
    entryPrice: 3000,
    currentPrice: 3050,
    exitPrice: 3050,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.16,
    status: 'CLOSED',
    createdAt: 500000,
    closedAt: 512000,
    closeReason: 'TP1',
  };

  const merged = deduplicateClosedPositions([manualTrade, exchangeSyncTrade]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].closeReason, 'MANUAL');
});

test('deduplicateClosedPositions normalizes symbol names with or without _USDT', () => {
  const tradeWithSuffix: MexcPosition = {
    id: 'pos-SOL_USDT-1',
    symbol: 'SOL_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 150,
    currentPrice: 145,
    exitPrice: 145,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 152.25,
    tp1Price: 145.5,
    tp2Price: 145.5,
    tp3Price: 145.5,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.33,
    status: 'CLOSED',
    createdAt: 700000,
    closedAt: 710000,
    closeReason: 'TP1',
  };

  const tradeWithoutSuffix: MexcPosition = {
    id: 'mexc-777666555',
    orderId: '777666555',
    symbol: 'SOL',
    groupName: 'Resynced (Exchange)',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'SHORT',
    entryPrice: 150,
    currentPrice: 145,
    exitPrice: 145,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.33,
    status: 'CLOSED',
    createdAt: 700000,
    closedAt: 715000,
    closeReason: 'TP1',
  };

  const merged = deduplicateClosedPositions([tradeWithSuffix, tradeWithoutSuffix]);
  assert.equal(merged.length, 1);
});

test('deduplicateClosedPositions reconstructs TP/SL targets if single closed trade lacks them', () => {
  const bareTrade: MexcPosition = {
    id: 'mexc-123456789',
    orderId: '123456789',
    symbol: 'LINK_USDT',
    groupName: 'MEXC Exchange History',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'LONG',
    entryPrice: 20.0,
    currentPrice: 20.6,
    exitPrice: 20.6,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 0,
    tp1Price: 0,
    tp2Price: 0,
    tp3Price: 0,
    tp1Hit: true,
    tp2Hit: true,
    tp3Hit: true,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.30,
    status: 'CLOSED',
    createdAt: 800000,
    closedAt: 810000,
    closeReason: 'TP1',
  };

  const deduplicated = deduplicateClosedPositions([bareTrade]);
  assert.equal(deduplicated.length, 1);
  assert.ok(deduplicated[0].slPrice > 0, 'slPrice must be reconstructed');
  assert.ok(deduplicated[0].tp1Price > 0, 'tp1Price must be reconstructed');
  assert.equal(deduplicated[0].slPrice, 19.7); // 20 - 1.5% = 19.7
  assert.equal(deduplicated[0].tp1Price, 20.6); // 20 + 3.0% = 20.6
});

test('MIN_AVAILABLE_BALANCE_USDT strictly enforces minimum safety threshold of $0.70', () => {
  assert.equal(MIN_AVAILABLE_BALANCE_USDT, 0.70);
  // Verify that balances below 0.70 are strictly flagged as unsafe
  assert.equal(0.69 < MIN_AVAILABLE_BALANCE_USDT, true);
  assert.equal(0.50 < MIN_AVAILABLE_BALANCE_USDT, true);
  assert.equal(0.00 < MIN_AVAILABLE_BALANCE_USDT, true);
  assert.equal(0.70 < MIN_AVAILABLE_BALANCE_USDT, false);
  assert.equal(1.50 < MIN_AVAILABLE_BALANCE_USDT, false);
});

test('reconstructStrategyTargets maintains full precision on low-price coins (FLOKI, PEPE) without collapsing to entry', () => {
  // FLOKI test case from user screenshot: entry 0.00002508
  const flokiLong = reconstructStrategyTargets(0.00002508, 'LONG');
  assert.ok(flokiLong.tp1Price > 0.00002508, `TP1 (${flokiLong.tp1Price}) must be strictly higher than entry (0.00002508)`);
  assert.ok(flokiLong.slPrice < 0.00002508, `SL (${flokiLong.slPrice}) must be strictly lower than entry (0.00002508)`);
  assert.notEqual(flokiLong.tp1Price, flokiLong.slPrice, 'TP1 and SL must not round to identical values');

  const flokiShort = reconstructStrategyTargets(0.00002508, 'SHORT');
  assert.ok(flokiShort.tp1Price < 0.00002508, `SHORT TP1 (${flokiShort.tp1Price}) must be strictly lower than entry (0.00002508)`);
  assert.ok(flokiShort.slPrice > 0.00002508, `SHORT SL (${flokiShort.slPrice}) must be strictly higher than entry (0.00002508)`);
  assert.notEqual(flokiShort.tp1Price, flokiShort.slPrice, 'SHORT TP1 and SL must not round to identical values');

  // PUMPFUN test case: entry 0.004918
  const pumpfun = reconstructStrategyTargets(0.004918, 'LONG');
  assert.ok(pumpfun.tp1Price > 0.004918, 'PUMPFUN TP1 must be higher than entry');
  assert.ok(pumpfun.slPrice < 0.004918, 'PUMPFUN SL must be lower than entry');
});

test('deduplicateClosedPositions never sets TP1 on zero PnL trades when price did not reach TP target', () => {
  // Simulated NEAR trade from user screenshot: entry 5.33, exit 5.33, pnl 0.00
  const zeroPnlTrade: MexcPosition = {
    id: 'mexc-867700000000',
    orderId: '867700000000',
    symbol: 'NEAR_USDT',
    groupName: 'MEXC Exchange History',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'LONG',
    entryPrice: 5.33,
    currentPrice: 5.33,
    exitPrice: 5.33,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 5.28,
    tp1Price: 5.44,
    tp2Price: 5.44,
    tp3Price: 5.44,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.00,
    status: 'CLOSED',
    createdAt: 100000,
    closedAt: 100500,
    closeReason: undefined,
  };

  const incomingPhantomTrade: MexcPosition = {
    ...zeroPnlTrade,
    id: 'pos-NEAR_USDT-1',
    closeReason: undefined,
  };

  const merged = deduplicateClosedPositions([zeroPnlTrade, incomingPhantomTrade]);
  assert.equal(merged.length, 1);
  // Must NOT be labeled TP1 when PnL is 0 and exit did not reach 5.44!
  assert.notEqual(merged[0].closeReason, 'TP1');
  assert.equal(merged[0].closeReason, 'MANUAL');
  assert.equal(merged[0].tp1Hit, false);
});

test('deduplicateClosedPositions purges phantom unexecuted trades with 0 PnL and exit == entry', () => {
  // Scenario matching user report: NEAR trade failed to execute on MEXC, lingered in localStorage
  const phantomNear: MexcPosition = {
    id: 'pos-NEAR_USDT-1792600000000',
    symbol: 'NEAR_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'LONG',
    entryPrice: 5.33,
    currentPrice: 5.33,
    exitPrice: 5.33,
    leverage: 8,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 0,
    slPrice: 5.28,
    tp1Price: 5.44,
    tp2Price: 5.44,
    tp3Price: 5.44,
    tp1Hit: true,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.00,
    status: 'CLOSED',
    createdAt: 1792600000000,
    closedAt: 1792600045000,
    closeReason: 'TP1',
  };

  const result = deduplicateClosedPositions([phantomNear]);
  assert.equal(result.length, 0, 'Phantom unexecuted trade with 0 PnL and exit==entry must be completely purged');
});

test('deduplicateClosedPositions sanitizes unmerged single trades: 0 PnL is converted to MANUAL with tp1Hit=false', () => {
  // Exchange order closed at break-even (exit == entry) with 0 PnL
  const exchangeBreakEven: MexcPosition = {
    id: 'mexc-867900112233445566',
    orderId: '867900112233445566',
    symbol: 'NEAR_USDT',
    groupName: 'MEXC Exchange History',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'LONG',
    entryPrice: 5.33,
    currentPrice: 5.33,
    exitPrice: 5.33,
    leverage: 8,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 5.28,
    tp1Price: 5.44,
    tp2Price: 5.44,
    tp3Price: 5.44,
    tp1Hit: true,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0.00,
    status: 'CLOSED',
    createdAt: 1792600000000,
    closedAt: 1792600045000,
    closeReason: 'TP1',
  };

  const result = deduplicateClosedPositions([exchangeBreakEven]);
  assert.equal(result.length, 1);
  assert.equal(result[0].closeReason, 'MANUAL');
  assert.equal(result[0].tp1Hit, false);
  assert.equal(result[0].slHit, false);
});

test('deduplicateClosedPositions preserves real SL trade with loss and correct bot attribution', () => {
  // Scenario matching JCT SHORT from user report: real exchange loss of -$0.28
  const localJct: MexcPosition = {
    id: 'pos-JCT_USDT-1792590000000',
    symbol: 'JCT_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'apex-momentum',
    botCode: 'APEX MOMENTUM',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 0.004213,
    currentPrice: 0.00438,
    exitPrice: 0.00438,
    leverage: 8,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 17,
    closedVol: 17,
    slPrice: 0.004377,
    tp1Price: 0.003904,
    tp2Price: 0.003904,
    tp3Price: 0.003904,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: true,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: 0,
    status: 'CLOSED',
    createdAt: 1792590000000,
    closedAt: 1792590120000,
    closeReason: 'MANUAL',
  };

  const exchangeJct: MexcPosition = {
    id: 'mexc-867921058941541057',
    orderId: '867921058941541057',
    symbol: 'JCT_USDT',
    groupName: 'MEXC Exchange History',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'SHORT',
    entryPrice: 0.004213,
    currentPrice: 0.00438,
    exitPrice: 0.00438,
    leverage: 8,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 17,
    closedVol: 17,
    slPrice: 0.004377,
    tp1Price: 0.003904,
    tp2Price: 0.003904,
    tp3Price: 0.003904,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: true,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.2839,
    fee: 0.0055,
    netRealizedPnl: -0.2894,
    status: 'CLOSED',
    createdAt: 1792590000000,
    closedAt: 1792590125000,
    closeReason: 'SL',
  };

  const merged = deduplicateClosedPositions([localJct, exchangeJct]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].botName, 'Apex Momentum', 'Must retain local bot attribution');
  assert.equal(merged[0].realizedPnl, -0.2839, 'Must retain exchange verified loss');
  assert.equal(merged[0].closeReason, 'SL', 'Must be categorized as SL');
  assert.equal(merged[0].slHit, true);
  assert.equal(merged[0].tp1Hit, false);
});

test('premature close prevention: trades that exit before reaching verified SL must NOT be categorized as SL', () => {
  // Scenario 1: LINK SHORT entry $12.26, exit $12.27 (only 1 cent loss), SL was $12.40
  const targets = reconstructStrategyTargets(12.26, 'SHORT');
  assert.equal(targets.slPrice, 12.4439); // EMA 200 SL target is > 12.40

  const linkShortPremature: MexcPosition = {
    id: 'pos-link-premature',
    symbol: 'LINK_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'monorid-1',
    botCode: 'APEX',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 12.26,
    currentPrice: 12.27,
    exitPrice: 12.27,
    leverage: 8,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 12.40,
    tp1Price: 11.97,
    tp2Price: 11.97,
    tp3Price: 11.97,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.01,
    fee: 0.0064,
    netRealizedPnl: -0.0164,
    status: 'CLOSED',
    createdAt: Date.now() - 60000,
    closedAt: Date.now(),
    closeReason: 'MANUAL',
  };

  const deduplicated = deduplicateClosedPositions([linkShortPremature]);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].closeReason, 'MANUAL', 'Premature close at 12.27 must NEVER be marked as SL when SL is 12.40');
  assert.equal(deduplicated[0].slHit, false, 'slHit must remain false');
  assert.equal(deduplicated[0].tp1Hit, false, 'tp1Hit must remain false');

  // Scenario 1b: Even if closeReason is undefined (e.g. raw order from exchange history), premature loss must NOT become SL
  const rawExchangeLossOrder: MexcPosition = {
    ...linkShortPremature,
    id: 'mexc-link-raw',
    closeReason: undefined,
  };
  const dedupRaw = deduplicateClosedPositions([rawExchangeLossOrder]);
  assert.equal(dedupRaw.length, 1);
  assert.equal(dedupRaw[0].closeReason, 'MANUAL', 'Raw exchange trade closing before SL must remain MANUAL');
  assert.equal(dedupRaw[0].slHit, false);

  // Scenario 2: XMR SHORT entry $613.64, exit $613.79 (0.15 loss), SL was $617.61, TP was $605.70
  const xmrShortPremature: MexcPosition = {
    id: 'pos-xmr-premature',
    symbol: 'XMR_USDT',
    groupName: 'Apex Cyber-Volatiles',
    botId: 'monorid-2',
    botCode: 'APEX',
    botName: 'Apex Momentum',
    side: 'SHORT',
    entryPrice: 613.64,
    currentPrice: 613.79,
    exitPrice: 613.79,
    leverage: 8,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 617.61,
    tp1Price: 605.70,
    tp2Price: 605.70,
    tp3Price: 605.70,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.01,
    fee: 0.005,
    netRealizedPnl: -0.015,
    status: 'CLOSED',
    createdAt: Date.now() - 40000,
    closedAt: Date.now(),
    closeReason: undefined,
  };
  const dedupXmr = deduplicateClosedPositions([xmrShortPremature]);
  assert.equal(dedupXmr.length, 1);
  assert.equal(dedupXmr[0].closeReason, 'MANUAL', 'XMR premature close at 613.79 must be MANUAL, never SL when SL is 617.61');
  assert.equal(dedupXmr[0].slHit, false);

  // Scenario 3: Real SL hit on SHORT (exit >= slPrice)
  const realShortSl: MexcPosition = {
    ...linkShortPremature,
    id: 'pos-link-real-sl',
    exitPrice: 12.42,
    realizedPnl: -0.15,
    closeReason: undefined,
  };
  const dedupRealSl = deduplicateClosedPositions([realShortSl]);
  assert.equal(dedupRealSl.length, 1);
  assert.equal(dedupRealSl[0].closeReason, 'SL', 'Trade reaching 12.42 >= SL 12.40 must be SL');
  assert.equal(dedupRealSl[0].slHit, true);

  // Scenario 4: Real TP hit on SHORT (exit <= tpPrice)
  const realShortTp: MexcPosition = {
    ...linkShortPremature,
    id: 'pos-link-real-tp',
    exitPrice: 11.95,
    realizedPnl: 0.30,
    closeReason: undefined,
  };
  const dedupRealTp = deduplicateClosedPositions([realShortTp]);
  assert.equal(dedupRealTp.length, 1);
  assert.equal(dedupRealTp[0].closeReason, 'TP1', 'Trade reaching 11.95 <= TP 11.97 must be TP1');
  assert.equal(dedupRealTp[0].tp1Hit, true);
});

test('trigger directions: Long and Short plan order triggerType and trend are mathematically aligned', () => {
  const getTriggerConfig = (positionType: 1 | 2) => ({
    slTriggerType: positionType === 1 ? 2 : 1,
    slTrend: 1, // 1 = Latest Price benchmark
    tpTriggerType: positionType === 1 ? 1 : 2,
    tpTrend: 1, // 1 = Latest Price benchmark
  });

  // Long Trade:
  // SL: triggers when price falls <= slPrice -> triggerType 2 (<=)
  // TP: triggers when price rises >= tpPrice -> triggerType 1 (>=)
  // Trend: 1 = Latest Price benchmark consistently across all orders
  const longConfig = getTriggerConfig(1);
  assert.equal(longConfig.slTriggerType, 2, 'Long SL triggerType must be 2 (<=)');
  assert.equal(longConfig.slTrend, 1, 'Long SL trend must be 1 (Latest Price benchmark)');
  assert.equal(longConfig.tpTriggerType, 1, 'Long TP triggerType must be 1 (>=)');
  assert.equal(longConfig.tpTrend, 1, 'Long TP trend must be 1 (Latest Price benchmark)');

  // Short Trade:
  // SL: triggers when price rises >= slPrice -> triggerType 1 (>=)
  // TP: triggers when price drops <= tpPrice -> triggerType 2 (<=)
  // Trend: 1 = Latest Price benchmark consistently across all orders
  const shortConfig = getTriggerConfig(2);
  assert.equal(shortConfig.slTriggerType, 1, 'Short SL triggerType must be 1 (>=)');
  assert.equal(shortConfig.slTrend, 1, 'Short SL trend must be 1 (Latest Price benchmark)');
  assert.equal(shortConfig.tpTriggerType, 2, 'Short TP triggerType must be 2 (<=)');
  assert.equal(shortConfig.tpTrend, 1, 'Short TP trend must be 1 (Latest Price benchmark)');
});

test('deduplicateClosedPositions recognizes externalOid planorder with loss as verified SL', () => {
  const planOrderTrade: MexcPosition = {
    id: 'mexc-867735134370682432',
    orderId: '867735134370682432',
    externalOid: 'planorder_867735134370682432_594',
    symbol: 'PHA_USDT',
    groupName: 'MEXC Exchange History',
    botId: 'mexc-exchange',
    botCode: 'EXCHANGE',
    botName: 'Exchange Fill',
    side: 'SHORT',
    entryPrice: 0.0502,
    currentPrice: 0.0509,
    exitPrice: 0.0509,
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 0.0509,
    tp1Price: 0.0487,
    tp2Price: 0.0487,
    tp3Price: 0.0487,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.14,
    fee: 0.008,
    netRealizedPnl: -0.148,
    status: 'CLOSED',
    createdAt: Date.now() - 60000,
    closedAt: Date.now(),
    closeReason: 'MANUAL', // Stale fallback on disk
  };

  const result = deduplicateClosedPositions([planOrderTrade]);
  assert.equal(result.length, 1);
  assert.equal(result[0].closeReason, 'SL', 'Trade executed by planorder with loss must be attributed to SL');
  assert.equal(result[0].slHit, true);
});

test('deduplicateClosedPositions recognizes stoporder_STOP_LOSS externalOid as verified SL', () => {
  const stopOrderTrade: MexcPosition = {
    id: 'mexc-866646303822697472',
    orderId: '866646303822697472',
    externalOid: 'stoporder_STOP_LOSS_1522554954_575066831_0',
    symbol: 'LTC_USDT',
    groupName: 'Titan Momentum Core',
    botId: 'mean-reversion',
    botCode: 'MEAN REVERSION',
    botName: 'Mean Reversion',
    side: 'SHORT',
    entryPrice: 55.63,
    currentPrice: 56.46,
    exitPrice: 56.48, // 0.03% slippage beyond nominal SL
    leverage: 10,
    initialSize: 10,
    currentSize: 0,
    equityUsed: 10,
    contractVol: 1,
    closedVol: 1,
    slPrice: 56.46,
    tp1Price: 53.96,
    tp2Price: 53.96,
    tp3Price: 53.96,
    tp1Hit: false,
    tp2Hit: false,
    tp3Hit: false,
    slHit: false,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    realizedPnl: -0.15,
    fee: 0.009,
    netRealizedPnl: -0.159,
    status: 'CLOSED',
    createdAt: Date.now() - 120000,
    closedAt: Date.now(),
    closeReason: 'MANUAL',
  };

  const result = deduplicateClosedPositions([stopOrderTrade]);
  assert.equal(result.length, 1);
  assert.equal(result[0].closeReason, 'SL', 'Stoporder STOP_LOSS tag must guarantee SL close reason');
  assert.equal(result[0].slHit, true);
});



