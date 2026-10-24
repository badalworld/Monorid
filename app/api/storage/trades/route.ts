import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredTrades,
  saveStoredTrades,
  appendStoredTrades,
  clearStoredTrades,
} from '@/lib/storage';
import { MexcPosition } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '0', 10);
    const symbolFilter = searchParams.get('symbol');
    const botIdFilter = searchParams.get('botId');

    let trades = await getStoredTrades();

    if (symbolFilter) {
      const symNorm = symbolFilter.toUpperCase();
      trades = trades.filter((t) => (t.symbol || '').toUpperCase().includes(symNorm));
    }
    if (botIdFilter) {
      trades = trades.filter((t) => t.botId === botIdFilter);
    }

    const result = limit > 0 ? trades.slice(0, limit) : trades;
    return NextResponse.json({
      success: true,
      count: result.length,
      total: trades.length,
      trades: result,
    });
  } catch (err: any) {
    console.error('[API /api/storage/trades GET] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch stored trades' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync';

    if (action === 'clear') {
      await clearStoredTrades();
      return NextResponse.json({
        success: true,
        count: 0,
        trades: [],
        message: 'Stored trade history cleared successfully',
      });
    }

    if (action === 'save') {
      const incoming: MexcPosition[] = Array.isArray(body.trades) ? body.trades : [];
      const saved = await saveStoredTrades(incoming);
      return NextResponse.json({
        success: true,
        count: saved.length,
        trades: saved,
      });
    }

    // Default: 'sync' or 'append'
    const incoming: MexcPosition[] = Array.isArray(body.trades)
      ? body.trades
      : body.trade
      ? [body.trade]
      : [];

    const updated = await appendStoredTrades(incoming);
    return NextResponse.json({
      success: true,
      count: updated.length,
      trades: updated,
    });
  } catch (err: any) {
    console.error('[API /api/storage/trades POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save trades' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearStoredTrades();
    return NextResponse.json({
      success: true,
      count: 0,
      trades: [],
      message: 'Stored trade history cleared successfully',
    });
  } catch (err: any) {
    console.error('[API /api/storage/trades DELETE] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to clear trades' },
      { status: 500 }
    );
  }
}
