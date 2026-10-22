import { NextRequest, NextResponse } from 'next/server';
import { mexcAuthRequest } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = process.env.MEXC_API_KEY || body.apiKey || '';
    const secretKey = process.env.MEXC_SECRET_KEY || body.secretKey || '';

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'API Key and Secret Key are required.' },
        { status: 400 }
      );
    }

    const data = await mexcAuthRequest(apiKey, secretKey, 'GET', '/api/v1/private/account/assets');

    if (data && data.success) {
      return NextResponse.json({
        success: true,
        message: 'MEXC API credentials verified successfully! Account assets accessed.',
        data: data.data,
      });
    } else {
      return NextResponse.json({
        success: false,
        code: data?.code || 401,
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
