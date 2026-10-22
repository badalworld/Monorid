import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndGroupMexcTickers,
  getStaticFallbackTickers,
  fetchMexcFuturesTickers,
  fetchMexcKlines,
  TOXIC_COIN_BLACKLIST,
  ASSET_GROUPS,
  fetchWithRetry,
} from './mexc.ts';

test('filterAndGroupMexcTickers handles empty, null, or invalid inputs gracefully', () => {
  assert.deepEqual(filterAndGroupMexcTickers([]), []);
  assert.deepEqual(filterAndGroupMexcTickers(null as any), []);
  assert.deepEqual(filterAndGroupMexcTickers(undefined as any), []);
  assert.deepEqual(filterAndGroupMexcTickers('invalid' as any), []);
});

test('filterAndGroupMexcTickers excludes non-USDT, stocks, commodities, forex, indices, and toxic blacklist coins', () => {
  const mockItems = [
    // Non USDT
    { symbol: 'BTC_USDC', contractId: 1, holdVol: 1000, fundingRate: 0.0001, lastPrice: 50000, fairPrice: 50000, high24Price: 51000, lower24Price: 49000, amount24: 5000000 },
    { symbol: 'ETH_EUR', contractId: 2, holdVol: 1000, fundingRate: 0.0001, lastPrice: 3000, fairPrice: 3000, high24Price: 3100, lower24Price: 2900, amount24: 5000000 },
    // Stocks / commodities / forex / indices
    { symbol: 'TESLA_USDT', contractId: 3, holdVol: 1000, fundingRate: 0.0001, lastPrice: 380, fairPrice: 380, high24Price: 390, lower24Price: 370, amount24: 5000000 },
    { symbol: 'COINBASE_USDT', contractId: 4, holdVol: 1000, fundingRate: 0.0001, lastPrice: 170, fairPrice: 170, high24Price: 175, lower24Price: 165, amount24: 5000000 },
    { symbol: 'USOIL_USDT', contractId: 5, holdVol: 1000, fundingRate: 0.0001, lastPrice: 99, fairPrice: 99, high24Price: 101, lower24Price: 97, amount24: 5000000 },
    { symbol: 'EUR_USDT', contractId: 6, holdVol: 1000, fundingRate: 0.0001, lastPrice: 1.05, fairPrice: 1.05, high24Price: 1.06, lower24Price: 1.04, amount24: 5000000 },
    { symbol: 'SOXL_USDT', contractId: 7, holdVol: 1000, fundingRate: 0.0001, lastPrice: 35, fairPrice: 35, high24Price: 38, lower24Price: 33, amount24: 5000000 },
    { symbol: 'US_INDEX_USDT', contractId: 8, holdVol: 1000, fundingRate: 0.0001, lastPrice: 5000, fairPrice: 5000, high24Price: 5100, lower24Price: 4900, amount24: 5000000 },
    // Toxic blacklist
    { symbol: 'BATON_USDT', contractId: 9, holdVol: 1000, fundingRate: 0.0001, lastPrice: 1, fairPrice: 1, high24Price: 1.1, lower24Price: 0.9, amount24: 5000000 },
    { symbol: 'Q_USDT', contractId: 10, holdVol: 1000, fundingRate: 0.0001, lastPrice: 1, fairPrice: 1, high24Price: 1.1, lower24Price: 0.9, amount24: 5000000 },
    { symbol: 'AAVE_USDT', contractId: 11, holdVol: 1000, fundingRate: 0.0001, lastPrice: 100, fairPrice: 100, high24Price: 110, lower24Price: 90, amount24: 5000000 },
    // Valid coin
    { symbol: 'SOL_USDT', contractId: 12, holdVol: 1000, fundingRate: 0.0001, lastPrice: 150, fairPrice: 150, high24Price: 160, lower24Price: 140, amount24: 5000000, riseFallRate: 0.05 },
  ];

  const result = filterAndGroupMexcTickers(mockItems);
  assert.equal(result.length, 1);
  assert.equal(result[0].symbol, 'SOL_USDT');
  assert.equal(result[0].groupName, ASSET_GROUPS[0].name);
});

test('filterAndGroupMexcTickers allocates thematic tokens to their matching groups', () => {
  // Create 90 candidates: 15 surge, 15 titan, 15 meme, 15 defi, 15 scalp, 15 ai
  const items = [];
  // 15 top surge
  for (let i = 0; i < 15; i++) {
    items.push({
      symbol: `SURGE${i}_USDT`,
      contractId: 200 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 10.0,
      fairPrice: 10.0,
      high24Price: 15.0,
      lower24Price: 8.0,
      amount24: 5000000,
      riseFallRate: 0.50 + i * 0.01, // extremely high volatility score
    });
  }

  // 15 Titan Momentum Core
  const titanSymbols = ['BTC_USDT', 'ETH_USDT', 'BNB_USDT', 'XRP_USDT', 'ADA_USDT', 'LINK_USDT', 'LTC_USDT', 'BCH_USDT', 'XLM_USDT', 'ETC_USDT', 'TRX_USDT', 'HBAR_USDT', 'VET_USDT', 'XMR_USDT', 'EOS_USDT'];
  titanSymbols.forEach((symbol, i) => {
    items.push({
      symbol,
      contractId: 300 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 100.0,
      fairPrice: 100.0,
      high24Price: 105.0,
      lower24Price: 95.0,
      amount24: 2000000,
      riseFallRate: 0.10,
    });
  });

  // 15 Quantum Velocity
  const memeSymbols = ['SHIB_USDT', 'PEPE_USDT', 'BONK_USDT', 'FLOKI_USDT', 'WIF_USDT', 'BOME_USDT', 'MEME_USDT', 'PEOPLE_USDT', 'NOT_USDT', 'TON_USDT', 'GALA_USDT', 'SAND_USDT', 'MANA_USDT', 'AXS_USDT', 'CHZ_USDT'];
  memeSymbols.forEach((symbol, i) => {
    items.push({
      symbol,
      contractId: 400 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 1.0,
      fairPrice: 1.0,
      high24Price: 1.1,
      lower24Price: 0.9,
      amount24: 2000000,
      riseFallRate: 0.09,
    });
  });

  // 15 DeFi & Layer-1 Vanguard
  const defiSymbols = ['ARB_USDT', 'OP_USDT', 'POL_USDT', 'SUI_USDT', 'APT_USDT', 'INJ_USDT', 'FTM_USDT', 'ALGO_USDT', 'DYDX_USDT', 'CRV_USDT', 'MKR_USDT', 'SNX_USDT', 'COMP_USDT', '1INCH_USDT', 'LDO_USDT'];
  defiSymbols.forEach((symbol, i) => {
    items.push({
      symbol,
      contractId: 500 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 2.0,
      fairPrice: 2.0,
      high24Price: 2.2,
      lower24Price: 1.8,
      amount24: 2000000,
      riseFallRate: 0.08,
    });
  });

  // 15 Alpha Rapid-Scalp
  const scalpSymbols = ['ORDI_USDT', 'SATS_USDT', 'RATS_USDT', 'KAS_USDT', 'STX_USDT', 'BLUR_USDT', 'PYTH_USDT', 'JTO_USDT', 'RUNE_USDT', 'AEVO_USDT', 'DYM_USDT', 'PIXEL_USDT', 'PORTAL_USDT', 'ALT_USDT', 'ONDO_USDT'];
  scalpSymbols.forEach((symbol, i) => {
    items.push({
      symbol,
      contractId: 600 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 3.0,
      fairPrice: 3.0,
      high24Price: 3.3,
      lower24Price: 2.7,
      amount24: 2000000,
      riseFallRate: 0.07,
    });
  });

  // 15 AI & Cyber Innovators
  const aiSymbols = ['RENDER_USDT', 'FET_USDT', 'TAO_USDT', 'NEAR_USDT', 'AGIX_USDT', 'OCEAN_USDT', 'RLC_USDT', 'PHB_USDT', 'AI_USDT', 'NFP_USDT', 'ARK_USDT', 'GLM_USDT', 'GRT_USDT', 'AR_USDT', 'THETA_USDT'];
  aiSymbols.forEach((symbol, i) => {
    items.push({
      symbol,
      contractId: 700 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 4.0,
      fairPrice: 4.0,
      high24Price: 4.4,
      lower24Price: 3.6,
      amount24: 2000000,
      riseFallRate: 0.06,
    });
  });

  const result = filterAndGroupMexcTickers(items);
  assert.equal(result.length, 90);

  // Group 0 should contain top volatility surge items
  const group0 = result.filter(t => t.groupIndex === 0);
  assert.equal(group0.length, 15);
  assert.equal(group0[0].symbol, 'SURGE14_USDT');

  // Group 1 should contain Titan large caps
  const group1 = result.filter(t => t.groupIndex === 1);
  assert.equal(group1.length, 15);
  assert.ok(group1.some(t => t.symbol === 'BTC_USDT'));

  // Group 2 should contain Meme / Quantum Velocity
  const group2 = result.filter(t => t.groupIndex === 2);
  assert.equal(group2.length, 15);
  assert.ok(group2.some(t => t.symbol === 'PEPE_USDT'));

  // Group 3 should contain DeFi
  const group3 = result.filter(t => t.groupIndex === 3);
  assert.equal(group3.length, 15);
  assert.ok(group3.some(t => t.symbol === 'ARB_USDT'));

  // Group 4 should contain Rapid Scalp
  const group4 = result.filter(t => t.groupIndex === 4);
  assert.equal(group4.length, 15);
  assert.ok(group4.some(t => t.symbol === 'ORDI_USDT'));

  // Group 5 should contain AI tokens
  const group5 = result.filter(t => t.groupIndex === 5);
  assert.equal(group5.length, 15);
  assert.ok(group5.some(t => t.symbol === 'RENDER_USDT'));
  assert.ok(group5.some(t => t.symbol === 'FET_USDT'));
});

test('filterAndGroupMexcTickers rejects zero/negative prices, inverted high/low, and extreme funding', () => {
  const invalidItems = [
    // Zero lastPrice
    { symbol: 'COIN1_USDT', contractId: 1, holdVol: 100, fundingRate: 0.0001, lastPrice: 0, fairPrice: 1, high24Price: 2, lower24Price: 0.5, amount24: 2000000 },
    // Inverted high/low
    { symbol: 'COIN2_USDT', contractId: 2, holdVol: 100, fundingRate: 0.0001, lastPrice: 1, fairPrice: 1, high24Price: 1, lower24Price: 2, amount24: 2000000 },
    // Excessive funding rate > 0.25%
    { symbol: 'COIN3_USDT', contractId: 3, holdVol: 100, fundingRate: 0.0035, lastPrice: 1, fairPrice: 1, high24Price: 1.2, lower24Price: 0.8, amount24: 2000000 },
    // Missing contractId
    { symbol: 'COIN4_USDT', contractId: 0, holdVol: 100, fundingRate: 0.0001, lastPrice: 1, fairPrice: 1, high24Price: 1.2, lower24Price: 0.8, amount24: 2000000 },
    // Missing holdVol
    { symbol: 'COIN5_USDT', contractId: 5, holdVol: 0, fundingRate: 0.0001, lastPrice: 1, fairPrice: 1, high24Price: 1.2, lower24Price: 0.8, amount24: 2000000 },
  ];

  const result = filterAndGroupMexcTickers(invalidItems);
  assert.equal(result.length, 0);
});

test('filterAndGroupMexcTickers adaptive tiering relaxes thresholds when liquidity is low', () => {
  // Generate 90 items with moderate turnover (300k USDT) and 1.8% spread
  const items = [];
  for (let i = 0; i < 90; i++) {
    items.push({
      symbol: `TEST${i}_USDT`,
      contractId: 100 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 10.0,
      fairPrice: 10.15, // 1.5% spread
      high24Price: 11.0,
      lower24Price: 9.0,
      amount24: 300000, // Below 1M and 500k, but above 100k
      riseFallRate: 0.02 + (i % 10) * 0.01,
    });
  }

  const result = filterAndGroupMexcTickers(items);
  assert.equal(result.length, 90, 'Adaptive tiering must populate all 90 tickers even if turnover is moderate');
  // Check that all 6 groups are populated with 15 assets each
  for (let g = 0; g < ASSET_GROUPS.length; g++) {
    const groupTickers = result.filter((t) => t.groupIndex === g);
    assert.equal(groupTickers.length, 15, `Group ${g} (${ASSET_GROUPS[g].name}) must have 15 tickers`);
  }
});

test('filterAndGroupMexcTickers distributes assets across groups when candidate count is less than 90', () => {
  // Generate 24 items
  const items = [];
  for (let i = 0; i < 24; i++) {
    items.push({
      symbol: `SYM${i}_USDT`,
      contractId: 100 + i,
      holdVol: 5000,
      fundingRate: 0.0001,
      lastPrice: 5.0,
      fairPrice: 5.0,
      high24Price: 5.5,
      lower24Price: 4.5,
      amount24: 2000000,
      riseFallRate: 0.05,
    });
  }

  const result = filterAndGroupMexcTickers(items);
  assert.ok(result.length >= 24, 'All available items must be included');
  // Verify every group receives assets
  for (let g = 0; g < ASSET_GROUPS.length; g++) {
    const inGroup = result.filter((t) => t.groupIndex === g);
    assert.ok(inGroup.length > 0, `Group ${g} (${ASSET_GROUPS[g].name}) must receive tickers`);
  }
});

test('getStaticFallbackTickers provides a complete 90-asset fallback set across all 6 groups', () => {
  const fallback = getStaticFallbackTickers();
  assert.equal(fallback.length, 90, 'Static fallback must provide exactly 90 assets');

  for (let g = 0; g < ASSET_GROUPS.length; g++) {
    const inGroup = fallback.filter((t) => t.groupIndex === g);
    assert.equal(inGroup.length, 15, `Group ${g} (${ASSET_GROUPS[g].name}) must have 15 tickers`);
    for (const ticker of inGroup) {
      assert.ok(ticker.symbol.endsWith('_USDT'), `${ticker.symbol} must end with _USDT`);
      assert.ok(ticker.lastPrice > 0, `${ticker.symbol} lastPrice must be positive`);
      assert.ok(ticker.amount24 > 0, `${ticker.symbol} amount24 must be positive`);
      assert.ok(ticker.volatilityScore > 0, `${ticker.symbol} volatilityScore must be positive`);
      assert.equal(ticker.groupName, ASSET_GROUPS[g].name);
    }
  }
});

test('fetchMexcFuturesTickers reliably returns market data (live, cached, or fallback)', async () => {
  const tickers = await fetchMexcFuturesTickers();
  assert.ok(Array.isArray(tickers), 'Must return an array');
  assert.ok(tickers.length >= 15, `Must return at least 15 tickers, received ${tickers.length}`);

  // Second immediate call should leverage cache
  const cached = await fetchMexcFuturesTickers();
  assert.equal(cached.length, tickers.length);
});

test('fetchWithRetry retries on HTTP 500/502/503 status codes before giving up or succeeding', async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount < 2) {
        return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const res = await fetchWithRetry('https://fake-endpoint.com', {}, 2, 1000);
    assert.equal(res.status, 200);
    assert.equal(callCount, 2, 'Should have retried once on HTTP 502');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchMexcKlines defaults to native Min1 interval and 280 limit for 1M scalp timeframe', async () => {
  let requestedUrl = '';
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: string) => {
      requestedUrl = url;
      const count = 280;
      const now = Math.floor(Date.now() / 1000);
      const times = Array.from({ length: count }, (_, i) => now - (count - i) * 60);
      const values = Array.from({ length: count }, () => 50000);
      return new Response(JSON.stringify({
        success: true,
        data: {
          time: times,
          open: values,
          high: values,
          low: values,
          close: values,
          vol: values,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const candles = await fetchMexcKlines('BTC_USDT');
    assert.ok(requestedUrl.includes('interval=Min1'), `Requested URL must specify interval=Min1, got: ${requestedUrl}`);
    assert.equal(candles.length, 280, 'Default fetch must return 280 native 1M candles');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
