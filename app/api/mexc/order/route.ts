import { NextRequest, NextResponse } from 'next/server';
import {
  placeMexcOrder,
  setMexcTPSL,
  closeMexcPosition,
  fetchMexcPositions,
  fetchMexcBalance,
  fetchMexcPositionMode,
} from '@/lib/mexc';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Client-provided credentials take precedence, env keys as fallback
  const MEXC_API_KEY = body.apiKey || process.env.MEXC_API_KEY || '';
  const MEXC_SECRET_KEY = body.secretKey || process.env.MEXC_SECRET_KEY || '';

  if (!MEXC_API_KEY || !MEXC_SECRET_KEY) {
    return NextResponse.json(
      { success: false, message: 'MEXC API keys not configured' },
      { status: 400 }
    );
  }

  try {
    const { action, ...params } = body;

    switch (action) {
      case 'place': {
        const result = await placeMexcOrder(MEXC_API_KEY, MEXC_SECRET_KEY, {
          symbol: params.symbol,
          side: params.side,
          type: params.type || '2',
          leverage: params.leverage,
          vol: params.vol,
          price: params.price,
        });
        return NextResponse.json(result);
      }

      case 'set_tpsl': {
        const result = await setMexcTPSL(
          MEXC_API_KEY,
          MEXC_SECRET_KEY,
          params.symbol,
          params.positionType,
          params.stopLossPrice,
          params.takeProfitPrice
        );
        return NextResponse.json(result);
      }

      case 'close': {
        const result = await closeMexcPosition(
          MEXC_API_KEY,
          MEXC_SECRET_KEY,
          params.symbol,
          params.positionType,
          params.quantity
        );
        return NextResponse.json(result);
      }

      case 'positions': {
        const positions = await fetchMexcPositions(MEXC_API_KEY, MEXC_SECRET_KEY);
        return NextResponse.json({ success: true, data: positions });
      }

      case 'position_mode': {
        const mode = await fetchMexcPositionMode(MEXC_API_KEY, MEXC_SECRET_KEY);
        return NextResponse.json({ success: mode !== null, data: mode });
      }

      case 'balance': {
        const balance = await fetchMexcBalance(MEXC_API_KEY, MEXC_SECRET_KEY);
        return NextResponse.json({ success: true, data: balance });
      }

      default:
        return NextResponse.json(
          { success: false, message: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
