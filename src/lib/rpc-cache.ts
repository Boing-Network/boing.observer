/**
 * Small in-memory TTL cache for RPC promises (shared by in-flight requests, so concurrent callers dedupe).
 * Bounded: without a cap, per-hash / per-address keys grow for the life of the tab (or Worker isolate).
 */

export const RPC_CACHE_MAX_ENTRIES = 500;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const rpcCache = new Map<string, CacheEntry<unknown>>();

function evictIfNeeded(now: number): void {
  if (rpcCache.size < RPC_CACHE_MAX_ENTRIES) return;
  // First drop everything expired, then oldest-inserted (Map preserves insertion order).
  for (const [k, v] of rpcCache) {
    if (v.expiresAt <= now) rpcCache.delete(k);
  }
  while (rpcCache.size >= RPC_CACHE_MAX_ENTRIES) {
    const oldest = rpcCache.keys().next();
    if (oldest.done) break;
    rpcCache.delete(oldest.value);
  }
}

export function cachedRpc<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = rpcCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }
  if (cached) rpcCache.delete(key);

  const promise = loader().catch((error) => {
    // Only drop our own entry; a newer load for the same key must survive.
    if (rpcCache.get(key)?.promise === promise) rpcCache.delete(key);
    throw error;
  });
  evictIfNeeded(now);
  rpcCache.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}

/** Test helper / manual refresh. */
export function clearRpcCache(): void {
  rpcCache.clear();
}

export function rpcCacheSize(): number {
  return rpcCache.size;
}
