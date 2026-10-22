import { NextRequest, NextResponse } from 'next/server';
import { fetchMexcBalance } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = process.env.MEXC_API_KEY || body.apiKey || '';
    const secretKey = process.env.MEXC_SECRET_KEY || body.secretKey || '';

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'MEXC API credentials not configured.' },
        { status: 400 }
      );
    }

    const balance = await fetchMexcBalance(apiKey, secretKey);

    if (balance) {
      return NextResponse.json({ success: true, balance });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance. Verify API credentials and IP whitelist.' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Balance fetch failed' },
      { status: 500 }
    );
  }
}
