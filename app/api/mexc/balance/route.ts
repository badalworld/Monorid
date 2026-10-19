import { NextRequest, NextResponse } from 'next/server';
import { fetchMexcBalance } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, secretKey } = await req.json();

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'API Key and Secret Key are required.' },
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
