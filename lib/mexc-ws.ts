/**
 * MEXC Futures WebSocket Price Feed
 * Real-time mark price and trade streams for open positions
 */

export interface WsPriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export type WsPriceCallback = (update: WsPriceUpdate) => void;

const MEXC_WS_URL = 'wss://contract.mexc.com/edge';

interface WsSubscription {
  symbol: string;
  callbacks: Set<WsPriceCallback>;
}

class MexcWebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, WsSubscription> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  /**
   * Subscribe to price updates for a symbol
   */
  subscribe(symbol: string, callback: WsPriceCallback): () => void {
    const upperSymbol = symbol.toUpperCase();

    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, {
        symbol: upperSymbol,
        callbacks: new Set(),
      });
      // If already connected, send subscription immediately (resubscribe only
      // fires on reconnect, so new symbols would otherwise never be sent)
      this.sendSymbolSubscription(upperSymbol);
    }

    this.subscriptions.get(upperSymbol)!.callbacks.add(callback);

    // Ensure WebSocket is connected
    this.ensureConnected();

    // Return unsubscribe function
    return () => {
      const sub = this.subscriptions.get(upperSymbol);
      if (sub) {
        sub.callbacks.delete(callback);
        if (sub.callbacks.size === 0) {
          this.subscriptions.delete(upperSymbol);
          this.resubscribe();
        }
      }
    };
  }

  /**
   * Get current price for a symbol (last received)
   */
  private lastPrices: Map<string, number> = new Map();

  getLastPrice(symbol: string): number | undefined {
    return this.lastPrices.get(symbol.toUpperCase());
  }

  /**
   * Ensure WebSocket connection is active
   */
  private ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.isConnecting) return;
    this.connect();
  }

  /**
   * Connect to MEXC WebSocket
   */
  private connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(MEXC_WS_URL);

      this.ws.onopen = () => {
        console.log('[MEXC WS] Connected');
        this.isConnecting = false;
        // Reset backoff only after a successful connection
        this.reconnectDelay = 1000;
        this.resubscribe();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          // Ignore parse errors
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[MEXC WS] Error:', err);
      };

      this.ws.onclose = () => {
        console.log('[MEXC WS] Disconnected');
        this.isConnecting = false;
        this.stopPing();
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[MEXC WS] Connection failed:', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(msg: any) {
    // MEXC push message formats:
    // Ticker: { channel: 'push.ticker', symbol: 'BTC_USDT', data: { lastPrice: 91420, ... } }
    // Deal:   { channel: 'push.deal',   symbol: 'BTC_USDT', data: { p: 91420 } }

    const symbol = msg.symbol;
    const price = msg.data?.lastPrice || msg.data?.p || msg.data?.price;

    if (symbol && price) {
      const upperSymbol = symbol.toUpperCase();
      this.lastPrices.set(upperSymbol, Number(price));

      const sub = this.subscriptions.get(upperSymbol);
      if (sub) {
        const update: WsPriceUpdate = {
          symbol: upperSymbol,
          price: Number(price),
          timestamp: Date.now(),
        };
        sub.callbacks.forEach((cb) => {
          try {
            cb(update);
          } catch (err) {
            console.warn('[MEXC WS] Callback error:', err);
          }
        });
      }
    }
  }

  /**
   * Send subscriptions for a single symbol on the current socket
   */
  private sendSymbolSubscription(symbol: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Ticker pushes ~1s snapshots (works for all symbols, even illiquid ones)
    this.send({
      method: 'sub.ticker',
      param: { symbol },
    });

    // Deal pushes fire on individual trades (granular, but rare for illiquid symbols)
    this.send({
      method: 'sub.deal',
      param: { symbol },
    });
  }

  /**
   * Resubscribe to all active symbols
   */
  private resubscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.subscriptions.forEach((sub) => {
      this.sendSymbolSubscription(sub.symbol);
    });
  }

  /**
   * Send message to WebSocket
   */
  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ method: 'ping' });
    }, 15000); // Ping every 15 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff.
   * Backoff is incremented AFTER the delay fires (not before connect),
   * so a fast successful reconnect always resets to 1000ms via onopen.
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = this.reconnectDelay;
    // Increase backoff for the NEXT attempt before scheduling this one
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.subscriptions.size > 0) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.lastPrices.clear();
  }
}

// Singleton instance
export const mexcWs = new MexcWebSocketManager();
