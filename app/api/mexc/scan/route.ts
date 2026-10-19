import { NextRequest, NextResponse } from 'next/server';
import { fetchMexcKlines, fetchMexcFuturesTickers } from '@/lib/mexc';
import { analyzeCrudeOilStrategy, aggregateCandles, DEFAULT_CONFIG, StrategyConfig } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbols: string[] = body.symbols || [];
    const config: StrategyConfig = { ...DEFAULT_CONFIG, ...(body.config || {}) };

    let targetSymbols = symbols;
    if (!targetSymbols || targetSymbols.length === 0) {
      const tickers = await fetchMexcFuturesTickers();
      targetSymbols = tickers.slice(0, 15).map((t) => t.symbol);
    }

    const batch = targetSymbols.slice(0, 8);

    const scanResults: any[] = [];
    for (const symbol of batch) {
      try {
        const klines1m = await fetchMexcKlines(symbol, 630, 'Min1');
        if (klines1m.length < 60) {
          scanResults.push({
            symbol,
            success: false,
            error: `Insufficient candle data for ${symbol} (${klines1m.length} bars)`,
          });
          continue;
        }
        const klines = aggregateCandles(klines1m, 3);
        const analysis = analyzeCrudeOilStrategy(klines, config);
        scanResults.push({
          symbol,
          success: true,
          analysis,
          candles: klines.slice(-30),
        });
      } catch (err: any) {
        scanResults.push({
          symbol,
          success: false,
          error: err?.message || 'Scan error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      results: scanResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Scanner pipeline failed' },
      { status: 500 }
    );
  }
}
