import { NextResponse } from 'next/server';
import { fetchMexcFuturesTickers, ASSET_GROUPS, getStaticFallbackTickers } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let tickers = await fetchMexcFuturesTickers();
    if (!tickers || tickers.length === 0) {
      tickers = getStaticFallbackTickers();
    }
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      groups: ASSET_GROUPS,
      count: tickers.length,
      tickers,
    });
  } catch (error: any) {
    console.error('[API /api/mexc/tickers] Exception during ticker fetch:', error);
    const fallbackTickers = getStaticFallbackTickers();
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      groups: ASSET_GROUPS,
      count: fallbackTickers.length,
      tickers: fallbackTickers,
      fallback: true,
      warning: error?.message || 'Upstream unavailable, served fallback tickers',
    });
  }
}

