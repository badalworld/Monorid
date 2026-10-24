import { NextRequest, NextResponse } from 'next/server';
import { fetchMexcKlines, fetchMexcFuturesTickers } from '@/lib/mexc';
import { analyzeMonoridStrategy, DEFAULT_CONFIG, StrategyConfig } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err: any) {
        results[idx] = {
          symbol: items[idx] as any,
          success: false,
          error: err?.message || 'Processing error',
        } as any;
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbols: string[] = body.symbols || [];
    const config: StrategyConfig = { ...DEFAULT_CONFIG, ...(body.config || {}) };

    let targetSymbols = symbols;
    if (!targetSymbols || targetSymbols.length === 0) {
      const tickers = await fetchMexcFuturesTickers();
      targetSymbols = tickers.map((t) => t.symbol);
    }

    const startTime = Date.now();
    // Balanced High-Throughput Concurrent Pipeline (8 in-flight workers) for rock-solid socket stability
    const scanResults = await runWithConcurrency(targetSymbols, 8, async (symbol) => {
      try {
        const klines = await fetchMexcKlines(symbol, 280, 'Min1');
        if (klines.length < 60) {
          return {
            symbol,
            success: false,
            error: `Insufficient candle data for ${symbol} (${klines.length} bars)`,
          };
        }
        const analysis = analyzeMonoridStrategy(klines, config);
        return {
          symbol,
          success: true,
          analysis,
          candles: targetSymbols.length <= 5 ? klines.slice(-220) : klines.slice(-30),
        };
      } catch (err: any) {
        return {
          symbol,
          success: false,
          error: err?.message || 'Scan error',
        };
      }
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      durationMs,
      results: scanResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Scanner pipeline failed' },
      { status: 500 }
    );
  }
}
