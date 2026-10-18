import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let detectedIp = '127.0.0.1';
  let provider = 'local';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    // Query public IPv4 resolution service
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        detectedIp = data.ip;
        provider = 'ipify';
      }
    }
  } catch (err) {
    try {
      // Secondary fallback
      const res2 = await fetch('https://ifconfig.me/ip', { cache: 'no-store' });
      if (res2.ok) {
        const text = await res2.text();
        detectedIp = text.trim();
        provider = 'ifconfig.me';
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({
    ip: detectedIp,
    provider,
    status: 'success',
    whitelistGuide: 'Add this IPv4 address to your MEXC API Key "IP Address Access" whitelist settings for secure execution.',
  });
}
