import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredLogs,
  appendStoredLogs,
  clearStoredLogs,
} from '@/lib/storage';
import { TradeLog } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '2000', 10);
    const typeFilter = searchParams.get('type');
    const symbolFilter = searchParams.get('symbol');

    let logs = await getStoredLogs(limit);

    if (typeFilter) {
      logs = logs.filter((l) => l.type === typeFilter);
    }
    if (symbolFilter) {
      const symNorm = symbolFilter.toUpperCase();
      logs = logs.filter((l) => (l.symbol || '').toUpperCase().includes(symNorm));
    }

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error('[API /api/storage/logs GET] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch stored logs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'append';

    if (action === 'clear') {
      await clearStoredLogs();
      return NextResponse.json({
        success: true,
        count: 0,
        logs: [],
        message: 'Stored logs cleared successfully',
      });
    }

    const incoming: TradeLog[] = Array.isArray(body.logs)
      ? body.logs
      : body.log
      ? [body.log]
      : [];

    if (incoming.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No logs provided to append',
      });
    }

    const result = await appendStoredLogs(incoming);
    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (err: any) {
    console.error('[API /api/storage/logs POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to append logs' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearStoredLogs();
    return NextResponse.json({
      success: true,
      count: 0,
      logs: [],
      message: 'Stored logs cleared successfully',
    });
  } catch (err: any) {
    console.error('[API /api/storage/logs DELETE] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
