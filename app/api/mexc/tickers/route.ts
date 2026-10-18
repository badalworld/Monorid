import { NextResponse } from 'next/server';
import { fetchMexcFuturesTickers, ASSET_GROUPS } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tickers = await fetchMexcFuturesTickers();
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      groups: ASSET_GROUPS,
      count: tickers.length,
      tickers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch futures tickers' },
      { status: 500 }
    );
  }
}
