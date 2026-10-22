import fs from 'fs';
import path from 'path';
import os from 'os';
import { deduplicateClosedPositions } from './mexc.ts';
import type { MexcPosition, TradeLog } from './mexc.ts';

// Limit maximum logs persisted to prevent unbounded file growth on disk
export const MAX_STORED_LOGS = 5000;
export const MAX_STORED_TRADES = 2000;

// Resolve safe persistent storage directory
let cachedStorageDir: string | null = null;

export function getStorageDir(): string {
  if (cachedStorageDir) return cachedStorageDir;

  const envDir = process.env.DATA_DIR;
  const preferredDirs = [
    envDir,
    path.join(process.cwd(), 'data'),
    path.join(os.tmpdir(), 'monorid-data'),
  ].filter(Boolean) as string[];

  for (const dir of preferredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Test write access
      const testFile = path.join(dir, `.write-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.tmp`);
      fs.writeFileSync(testFile, 'ok', 'utf8');
      fs.unlinkSync(testFile);
      cachedStorageDir = dir;
      return dir;
    } catch {
      // Try next fallback directory
      continue;
    }
  }

  // Final fallback: current working directory
  cachedStorageDir = process.cwd();
  return cachedStorageDir;
}

export function getTradesFilePath(): string {
  return path.join(getStorageDir(), 'trades.json');
}

export function getLogsFilePath(): string {
  return path.join(getStorageDir(), 'logs.json');
}

// Mutex queues to serialize concurrent writes and prevent race conditions or corrupted JSON
class FileMutex {
  private queue: Promise<any> = Promise.resolve();

  dispatch<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => action(), () => action());
    this.queue = next.catch(() => {});
    return next;
  }
}

const tradesMutex = new FileMutex();
const logsMutex = new FileMutex();

/**
 * Safely writes JSON content atomically (writes to temp file, then renames/overwrites)
 */
async function atomicWriteJson(filePath: string, data: any): Promise<void> {
  const serialized = JSON.stringify(data, null, 2);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  const tmpPath = path.join(dir, `.tmp-${path.basename(filePath)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  try {
    await fs.promises.writeFile(tmpPath, serialized, 'utf8');
    // On Windows, rename might fail if destination exists and is open; try rename with fallback to copy/unlink
    try {
      await fs.promises.rename(tmpPath, filePath);
    } catch {
      await fs.promises.copyFile(tmpPath, filePath);
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    // If temp file write failed, attempt direct write as emergency fallback
    try {
      await fs.promises.writeFile(filePath, serialized, 'utf8');
    } catch (fallbackErr) {
      console.error(`[Storage] Failed to write ${filePath}:`, fallbackErr);
      throw fallbackErr;
    }
  } finally {
    if (fs.existsSync(tmpPath)) {
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  }
}

/**
 * Safely reads and parses JSON from file. Returns defaultValue if file does not exist or is corrupted.
 */
async function safeReadJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    if (!content || !content.trim()) {
      return defaultValue;
    }
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`[Storage] Error reading ${filePath}, falling back to default:`, err);
    return defaultValue;
  }
}

// ─── Trade History Storage ──────────────────────────────────────────────────

/**
 * Retrieves the full persisted trade history from server disk.
 */
export async function getStoredTrades(): Promise<MexcPosition[]> {
  const filePath = getTradesFilePath();
  const raw = await safeReadJson<MexcPosition[]>(filePath, []);
  if (!Array.isArray(raw)) return [];
  return deduplicateClosedPositions(raw);
}

/**
 * Overwrites the persisted trade history with a validated, deduplicated array.
 */
export async function saveStoredTrades(trades: MexcPosition[]): Promise<MexcPosition[]> {
  return tradesMutex.dispatch(async () => {
    const valid = Array.isArray(trades) ? trades : [];
    const deduplicated = deduplicateClosedPositions(valid);
    // Keep up to MAX_STORED_TRADES
    const trimmed = deduplicated.slice(0, MAX_STORED_TRADES);
    const filePath = getTradesFilePath();
    await atomicWriteJson(filePath, trimmed);
    return trimmed;
  });
}

/**
 * Merges incoming trade(s) with existing server trade history and persists the deduplicated result.
 */
export async function appendStoredTrades(newTrades: MexcPosition[] | MexcPosition): Promise<MexcPosition[]> {
  return tradesMutex.dispatch(async () => {
    const incoming = Array.isArray(newTrades) ? newTrades : [newTrades];
    if (incoming.length === 0) {
      return getStoredTrades();
    }

    const existing = await safeReadJson<MexcPosition[]>(getTradesFilePath(), []);
    const merged = deduplicateClosedPositions([...existing, ...incoming]);
    const trimmed = merged.slice(0, MAX_STORED_TRADES);
    await atomicWriteJson(getTradesFilePath(), trimmed);
    return trimmed;
  });
}

/**
 * Clears the persisted trade history.
 */
export async function clearStoredTrades(): Promise<void> {
  return tradesMutex.dispatch(async () => {
    await atomicWriteJson(getTradesFilePath(), []);
  });
}

// ─── Logs Storage ────────────────────────────────────────────────────────────

/**
 * Retrieves persisted logs, optionally limited to the most recent N entries.
 */
export async function getStoredLogs(limit: number = 2000): Promise<TradeLog[]> {
  const filePath = getLogsFilePath();
  const raw = await safeReadJson<TradeLog[]>(filePath, []);
  if (!Array.isArray(raw)) return [];
  // Sort descending by timestamp (newest first)
  const sorted = raw.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return limit > 0 ? sorted.slice(0, limit) : sorted;
}

/**
 * Appends new logs to the persistent server storage, deduplicating and maintaining newest-first order.
 */
export async function appendStoredLogs(newLogs: TradeLog[] | TradeLog): Promise<{ count: number; logs: TradeLog[] }> {
  return logsMutex.dispatch(async () => {
    const incoming = Array.isArray(newLogs) ? newLogs : [newLogs];
    if (incoming.length === 0) {
      const existing = await safeReadJson<TradeLog[]>(getLogsFilePath(), []);
      return { count: existing.length, logs: existing };
    }

    const existing = await safeReadJson<TradeLog[]>(getLogsFilePath(), []);
    
    // Deduplicate logs by unique ID or composite key
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();
    const combined: TradeLog[] = [];

    const addIfUnique = (log: TradeLog) => {
      if (!log || typeof log !== 'object') return;
      if (log.id && seenIds.has(log.id)) return;
      
      const sig = `${log.timestamp || 0}|${log.symbol || ''}|${log.type || ''}|${(log.message || '').slice(0, 50)}`;
      if (seenSignatures.has(sig)) return;

      if (log.id) seenIds.add(log.id);
      seenSignatures.add(sig);
      combined.push(log);
    };

    // Add incoming logs first (newest)
    for (const log of incoming) addIfUnique(log);
    // Add existing logs
    for (const log of existing) addIfUnique(log);

    // Sort newest first
    combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const trimmed = combined.slice(0, MAX_STORED_LOGS);

    await atomicWriteJson(getLogsFilePath(), trimmed);
    return { count: trimmed.length, logs: trimmed };
  });
}

/**
 * Clears the persisted logs on the server.
 */
export async function clearStoredLogs(): Promise<void> {
  return logsMutex.dispatch(async () => {
    await atomicWriteJson(getLogsFilePath(), []);
  });
}
