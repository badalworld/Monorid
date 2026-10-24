import { NextRequest, NextResponse } from 'next/server';
import {
  placeMexcOrder,
  setMexcTPSL,
  closeMexcPosition,
  cancelAllPendingOrders,
  fetchMexcPositions,
  fetchMexcBalance,
  fetchMexcPositionMode,
  mexcAuthRequest,
  extractOrderFeeAndFunding,
  deduplicateClosedPositions,
  reconstructStrategyTargets,
  MIN_AVAILABLE_BALANCE_USDT,
  type MexcPosition,
} from '@/lib/mexc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON request body' }, { status: 400 });
  }

  // Server-configured environment credentials take precedence for security;
  // client-provided credentials allowed for user setting configurations.
  const MEXC_API_KEY = process.env.MEXC_API_KEY || body.apiKey || '';
  const MEXC_SECRET_KEY = process.env.MEXC_SECRET_KEY || body.secretKey || '';

  if (!MEXC_API_KEY || !MEXC_SECRET_KEY) {
    return NextResponse.json(
      { success: false, message: 'MEXC API credentials not configured.' },
      { status: 400 }
    );
  }

  try {
    const { action, ...params } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ success: false, message: 'Action is required.' }, { status: 400 });
    }

    const validateSymbol = (sym: any): string => {
      if (!sym || typeof sym !== 'string' || !/^[A-Z0-9_]{2,30}$/.test(sym)) {
        throw new Error(`Invalid symbol: ${sym}`);
      }
      return sym;
    };

    switch (action) {
      case 'place': {
        const symbol = validateSymbol(params.symbol);
        const side = params.side === 'BUY' || params.side === 'SELL' ? params.side : null;
        if (!side) {
          return NextResponse.json({ success: false, message: 'Invalid side (must be BUY or SELL)' }, { status: 400 });
        }

        const vol = Number(params.vol);
        if (!vol || vol <= 0 || isNaN(vol)) {
          return NextResponse.json({ success: false, message: 'Invalid volume' }, { status: 400 });
        }

        // Strict Server-Side Safety: Block trade if available balance or equity is below $0.70
        try {
          const balance = await fetchMexcBalance(MEXC_API_KEY, MEXC_SECRET_KEY);
          if (balance) {
            const avail = balance.availableBalance !== undefined ? balance.availableBalance : 0;
            const eq = balance.totalEquity !== undefined ? balance.totalEquity : 0;
            if (avail < MIN_AVAILABLE_BALANCE_USDT || eq < MIN_AVAILABLE_BALANCE_USDT) {
              return NextResponse.json({
                success: false,
                message: `Trade blocked: Available balance ($${avail.toFixed(2)}) is below minimum safety threshold ($${MIN_AVAILABLE_BALANCE_USDT.toFixed(2)}).`,
              }, { status: 400 });
            }
          }
        } catch (balErr) {
          console.warn('[MEXC API] Pre-trade balance check warning:', balErr);
        }

        const result = await placeMexcOrder(MEXC_API_KEY, MEXC_SECRET_KEY, {
          symbol,
          side,
          type: Number(params.type) || 5, // 5 = market order default
          leverage: params.leverage ? Number(params.leverage) : undefined,
          vol,
          price: params.price ? Number(params.price) : undefined,
          stopLossPrice: params.stopLossPrice ? Number(params.stopLossPrice) : undefined,
          takeProfitPrice: params.takeProfitPrice ? Number(params.takeProfitPrice) : undefined,
        });
        return NextResponse.json(result);
      }

      case 'set_tpsl': {
        const symbol = validateSymbol(params.symbol);
        const positionType = Number(params.positionType);
        if (positionType !== 1 && positionType !== 2) {
          return NextResponse.json({ success: false, message: 'positionType must be 1 (Long) or 2 (Short)' }, { status: 400 });
        }

        const result = await setMexcTPSL(
          MEXC_API_KEY,
          MEXC_SECRET_KEY,
          symbol,
          positionType as 1 | 2,
          params.stopLossPrice ? Number(params.stopLossPrice) : undefined,
          params.takeProfitPrice ? Number(params.takeProfitPrice) : undefined,
          params.vol ? Math.max(1, Number(params.vol)) : 1,
          params.openType === 2 ? 2 : 1,
          params.tpVol ? Math.max(1, Number(params.tpVol)) : undefined
        );
        return NextResponse.json(result);
      }

      case 'close': {
        const symbol = validateSymbol(params.symbol);
        const positionType = Number(params.positionType);
        if (positionType !== 1 && positionType !== 2) {
          return NextResponse.json({ success: false, message: 'positionType must be 1 (Long) or 2 (Short)' }, { status: 400 });
        }

        const quantity = Number(params.quantity);
        if (!quantity || quantity <= 0 || isNaN(quantity)) {
          return NextResponse.json({ success: false, message: 'Invalid close quantity' }, { status: 400 });
        }

        const result = await closeMexcPosition(
          MEXC_API_KEY,
          MEXC_SECRET_KEY,
          symbol,
          positionType as 1 | 2,
          quantity
        );
        return NextResponse.json(result);
      }

      case 'cancel_all': {
        const symbol = validateSymbol(params.symbol);
        const result = await cancelAllPendingOrders(MEXC_API_KEY, MEXC_SECRET_KEY, symbol);
        return NextResponse.json(result);
      }

      case 'positions': {
        const positions = await fetchMexcPositions(MEXC_API_KEY, MEXC_SECRET_KEY);
        return NextResponse.json({ success: true, data: positions });
      }

      case 'history_orders':
      case 'history_positions': {
        const page_size = Math.min(100, Number(params.page_size) || 100);
        const page_num = Number(params.page_num) || 1;
        const queryParams: Record<string, string | number> = {
          page_num,
          page_size,
        };
        if (params.symbol) {
          queryParams.symbol = validateSymbol(params.symbol);
        }
        const endpoint = action === 'history_positions'
          ? '/api/v1/private/position/list/history_positions'
          : '/api/v1/private/order/list/history_orders';

        const result = await mexcAuthRequest(MEXC_API_KEY, MEXC_SECRET_KEY, 'GET', endpoint, queryParams);

        if (result && Array.isArray(result.data)) {
          const enrichedOrders = result.data.map((order: any) => {
            const feeInfo = extractOrderFeeAndFunding(order);
            return {
              ...order,
              extractedFee: feeInfo.fee,
              extractedFundingFee: feeInfo.fundingFee,
              netProfit: feeInfo.netPnl,
            };
          });

          result.data = enrichedOrders;

          // Build and deduplicate closed trade records
          const rawClosedTrades: MexcPosition[] = enrichedOrders
            .filter((o: any) => {
              if (action === 'history_positions') {
                return (o.state === 2 || o.closePrice || o.closeProfit !== undefined || o.realised !== undefined)
                  && (Number(o.vol) > 0 || Number(o.dealVol) > 0 || Number(o.closeVol) > 0);
              }
              // Strictly exclude cancelled/failed orders (state 4 = cancelled, 5 = partially cancelled)
              // Only completed orders (state 3) with actual filled volume (dealVol > 0)
              // And ONLY closing orders (side 2 = close short, side 4 = close long) or orders with realised profit
              const isCloseOrder = o.side === 2 || o.side === 4;
              const hasDealVol = Number(o.dealVol) > 0;
              const isCompleted = o.state === 3;
              return isCompleted && hasDealVol && (isCloseOrder || (o.profit !== 0 && o.profit !== undefined));
            })
            .map((order: any) => {
              const feeInfo = extractOrderFeeAndFunding(order);
              const isLong = action === 'history_positions'
                ? (order.positionType === 1 || order.holdSide === 1)
                : (order.side === 1 || order.side === 4 ? true : order.side === 2 || order.side === 3 ? false : (order.positionType === 1 || (Number(order.profit) || 0) >= 0));
              const side: 'LONG' | 'SHORT' = isLong ? 'LONG' : 'SHORT';
              const pnl = feeInfo.realizedPnl;
              const pnlRate = Number(order.pnlRate) || 0;
              const entry = Number(order.openAvgPrice) || Number(order.openPrice) || Number(order.dealAvgPrice) || 0;
              const exit = Number(order.dealAvgPrice) || Number(order.closePrice) || entry;
              const targets = reconstructStrategyTargets(entry, side);

              let closeReason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL';
              let hitTp = false;
              let hitSl = false;

              const extOid = String(order.externalOid || '');
              const isSlOrder = extOid.includes('STOP_LOSS') || (extOid.includes('planorder') && pnl < 0);
              const isTpOrder = extOid.includes('TAKE_PROFIT') || (extOid.includes('planorder') && pnl > 0);

              const reachedSl = isLong
                ? exit <= targets.slPrice * 1.0015 && targets.slPrice < entry
                : exit >= targets.slPrice * 0.9985 && targets.slPrice > entry;
              const reachedTp = isLong
                ? exit >= targets.tp1Price * 0.9985 && targets.tp1Price > entry
                : exit <= targets.tp1Price * 1.0015 && targets.tp1Price < entry && targets.tp1Price > 0;

              if (isSlOrder || (reachedSl && pnl < -0.0001)) {
                closeReason = 'SL';
                hitSl = true;
              } else if (isTpOrder || (reachedTp && pnl > 0.0001)) {
                closeReason = 'TP1';
                hitTp = true;
              } else if (pnl < -0.0001) {
                closeReason = 'SL';
                hitSl = true;
              } else if (pnl > 0.0001) {
                closeReason = 'TP1';
                hitTp = true;
              } else {
                closeReason = 'MANUAL';
              }

              const orderId = order.orderId ? String(order.orderId) : undefined;
              const positionId = order.positionId ? Number(order.positionId) : undefined;
              const id = orderId ? `mexc-${orderId}` : positionId ? `pos-${positionId}` : `mexc-${order.symbol}-${Date.now()}`;

              return {
                id,
                orderId,
                positionId,
                symbol: order.symbol,
                groupName: 'MEXC Exchange History',
                botId: 'mexc-exchange',
                botCode: 'EXCHANGE',
                botName: 'Exchange Fill',
                side,
                entryPrice: entry,
                currentPrice: exit,
                exitPrice: exit,
                leverage: Number(order.leverage) || 10,
                initialSize: Number(order.orderMargin) || 10,
                currentSize: 0,
                equityUsed: Number(order.orderMargin) || 10,
                contractVol: Number(order.dealVol) || Number(order.vol) || 1,
                closedVol: Number(order.dealVol) || Number(order.vol) || 1,
                slPrice: targets.slPrice,
                tp1Price: targets.tp1Price,
                tp2Price: targets.tp2Price,
                tp3Price: targets.tp3Price,
                tp1Hit: hitTp,
                tp2Hit: hitTp,
                tp3Hit: hitTp,
                slHit: hitSl,
                unrealizedPnl: 0,
                unrealizedPnlPct: 0,
                realizedPnl: pnl,
                realizedPnlPct: pnlRate ? pnlRate * 100 : 0,
                fee: feeInfo.fee,
                fundingFee: feeInfo.fundingFee,
                netRealizedPnl: feeInfo.netPnl,
                status: 'CLOSED' as const,
                createdAt: Number(order.createTime) || Date.now(),
                closedAt: Number(order.updateTime) || Number(order.createTime) || Date.now(),
                closeReason,
              };
            });

          result.deduplicatedClosedTrades = deduplicateClosedPositions(rawClosedTrades);
          result.closedTrades = result.deduplicatedClosedTrades;
        }

        return NextResponse.json(result);
      }

      case 'position_mode': {
        const mode = await fetchMexcPositionMode(MEXC_API_KEY, MEXC_SECRET_KEY);
        return NextResponse.json({ success: mode !== null, data: mode });
      }

      case 'balance': {
        const balance = await fetchMexcBalance(MEXC_API_KEY, MEXC_SECRET_KEY);
        return NextResponse.json({ success: true, data: balance });
      }

      case 'list_tpsl': {
        const symbol = validateSymbol(params.symbol);
        const result = await mexcAuthRequest(MEXC_API_KEY, MEXC_SECRET_KEY, 'GET', '/api/v1/private/stoporder/list/orders', {
          symbol,
        });
        return NextResponse.json(result);
      }

      case 'place_tpsl': {
        const symbol = validateSymbol(params.symbol);
        const positionType = Number(params.positionType);
        const result = await mexcAuthRequest(MEXC_API_KEY, MEXC_SECRET_KEY, 'POST', '/api/v1/private/stoporder/place', {
          symbol,
          positionType: positionType === 2 ? 2 : 1,
          openType: params.openType || 1,
          vol: Number(params.vol) || 1,
          stopLossPrice: params.stopLossPrice ? Number(params.stopLossPrice) : undefined,
          takeProfitPrice: params.takeProfitPrice ? Number(params.takeProfitPrice) : undefined,
        } as any);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { success: false, message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Internal order processing error' },
      { status: 500 }
    );
  }
}
