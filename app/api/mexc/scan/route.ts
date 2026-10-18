import { NextRequest, NextResponse } from 'next/server';
import { fetchMexcKlines, fetchMexcFuturesTickers } from '@/lib/mexc';
import { analyzeLiquidityReaper, DEFAULT_CONFIG, StrategyConfig } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbols: string[] = body.symbols || [];
    const config: StrategyConfig = { ...DEFAULT_CONFIG, ...(body.config || {}) };

    let targetSymbols = symbols;
    if (!targetSymbols || targetSymbols.length === 0) {
      // Default to scanning top volatile symbols from market
      const tickers = await fetchMexcFuturesTickers();
      targetSymbols = tickers.slice(0, 15).map((t) => t.symbol);
    }

    // Limit batch scan to 15 concurrent to prevent MEXC API rate limits
    const batch = targetSymbols.slice(0, 15);

    const scanResults = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const klines = await fetchMexcKlines(symbol, 75);
          const analysis = analyzeLiquidityReaper(klines, config);
          return {
            symbol,
            success: true,
            analysis,
            candles: klines.slice(-30), // recent candles for chart preview
          };
        } catch (err: any) {
          return {
            symbol,
            success: false,
            error: err?.message || 'Scan error',
          };
        }
      })
    );

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
