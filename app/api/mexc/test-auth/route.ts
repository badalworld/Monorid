import { NextRequest, NextResponse } from 'next/server';
import { generateMexcSignature } from '@/lib/mexc';

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

    const timestamp = Date.now();
    const signature = generateMexcSignature(apiKey, secretKey, timestamp, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://contract.mexc.com/api/v1/private/account/assets', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'ApiKey': apiKey,
        'Request-Time': timestamp.toString(),
        'Signature': signature,
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => null);

    if (res.ok && data && data.success) {
      return NextResponse.json({
        success: true,
        message: 'MEXC API credentials verified successfully! Account assets accessed.',
        data: data.data,
      });
    } else {
      return NextResponse.json({
        success: false,
        code: data?.code || res.status,
        message: data?.message || 'Authentication rejected by MEXC API. Please verify IP whitelisting and permissions.',
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: `Connection test failed: ${error?.message || 'Network timeout'}`,
    });
  }
}
