import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const botToken = process.env.TELEGRAM_BOT_TOKEN || body.botToken;
    const chatId = process.env.TELEGRAM_CHAT_ID || body.chatId;
    const { test, type, symbol, side, price, sl, tp1, tp2, tp3, leverage, pnl, groupName, details } = body;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: 'Telegram Bot Token and Chat ID are required.' },
        { status: 400 }
      );
    }

    let message = '';

    if (test) {
      message = `⚡ <b>MONORID ALGORITHMIC ENGINE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ <b>Telegram Notification Link Verified</b>\n` +
        `• <b>System:</b> Monorid 24/7 Futures Quant Bot\n` +
        `• <b>Developed By:</b> Trading Lifestyle Quant\n` +
        `• <b>Status:</b> Ready for real-time trade signals, TP/SL alerts, and execution logs.\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    } else if (type === 'ENTRY') {
      const isLong = side === 'LONG';
      const isSameCandle = details?.candleTiming === 'SAME_CANDLE' || body.candleTiming === 'SAME_CANDLE';
      const icon = isLong
        ? `🟢 <b>[MARKET CIPHER B BUY CONFIRMED${isSameCandle ? ' • GREEN DOT' : ''}]</b>`
        : `🔴 <b>[MARKET CIPHER B SELL CONFIRMED${isSameCandle ? ' • RED DOT' : ''}]</b>`;
      message = `${icon}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Bot:</b> Monorid Quant Core\n` +
        `• <b>Contract:</b> ${symbol}\n` +
        `• <b>Group:</b> ${groupName || 'Volatiles'}\n` +
        `• <b>Direction:</b> ${side}\n` +
        `• <b>Entry Price:</b> $${price}\n` +
        `• <b>Leverage:</b> ${leverage || 7}x\n` +
        `• <b>Equity Allocation:</b> 10% Portfolio\n` +
        `• <b>Risk/Reward Targets:</b>\n` +
        `   🛑 Stop Loss (EMA 200): $${sl}\n` +
        `   🎯 Take Profit (1:2 Target • 100%): $${tp1}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Market Cipher B Quant Engine</i>`;
    } else if (type === 'TP1_HIT') {
      message = `🎯 <b>[TAKE PROFIT REACHED - 1:2 TARGET FULLY SECURED]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Contract:</b> ${symbol} (${side})\n` +
        `• <b>Trigger Price:</b> $${price}\n` +
        `• <b>Position Action:</b> 100% Closed (1:2 Target)\n` +
        `• <b>Realized P&L:</b> +$${pnl?.toFixed(2) || '0.00'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Market Cipher B 24/7 Execution</i>`;
    } else if (type === 'TP2_HIT') {
      message = `🎯 <b>[TARGET 2 REACHED - 50% SECURED]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Contract:</b> ${symbol} (${side})\n` +
        `• <b>Trigger Price:</b> $${price}\n` +
        `• <b>Position Action:</b> 50% Closed\n` +
        `• <b>Realized P&L:</b> +$${pnl?.toFixed(2) || '0.00'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Monorid 24/7 Execution</i>`;
    } else if (type === 'TP3_HIT') {
      message = `🏆 <b>[TARGET 3 REACHED - FULL EXIT]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Contract:</b> ${symbol} (${side})\n` +
        `• <b>Trigger Price:</b> $${price}\n` +
        `• <b>Position Action:</b> 100% Closed (Runner Complete)\n` +
        `• <b>Total Realized P&L:</b> +$${pnl?.toFixed(2) || '0.00'}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Trading Lifestyle Quant Engine</i>`;
    } else if (type === 'SL_HIT') {
      message = `🛑 <b>[STOP LOSS EXECUTED]</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Contract:</b> ${symbol} (${side})\n` +
        `• <b>Exit Price:</b> $${price}\n` +
        `• <b>P&L:</b> -$${Math.abs(pnl || 0).toFixed(2)}\n` +
        `• <b>Risk Protection:</b> Capital Preserved\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Monorid 24/7 Execution</i>`;
    } else {
      message = `ℹ️ <b>MONORID SYSTEM ALERT</b>\n${details?.note || 'Market scan update'}`;
    }

    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const tgData = await tgRes.json().catch(() => ({}));

    if (tgRes.ok && tgData.ok) {
      return NextResponse.json({ success: true, message: 'Telegram alert dispatched successfully.' });
    } else {
      return NextResponse.json({
        success: false,
        error: tgData.description || 'Telegram API rejected message',
      }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to dispatch Telegram message' },
      { status: 500 }
    );
  }
}
