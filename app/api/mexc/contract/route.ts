import { NextResponse } from 'next/server';
import { fetchMexcContractDetailRemote } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ success: false, error: 'symbol required' }, { status: 400 });
  }

  const detail = await fetchMexcContractDetailRemote(symbol);
  if (!detail) {
    return NextResponse.json({ success: false, error: 'contract detail unavailable' }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    symbol,
    contractSize: detail.contractSize,
    apiAllowed: detail.apiAllowed,
  });
}
