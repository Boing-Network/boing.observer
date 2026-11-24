/**
 * Shared edge cache for `/api/rpc` (Cloudflare Workers Cache API, free on every plan).
 *
 * Every page view used to go to the node, even for blocks and receipts that can never change. This caches
 * JSON-RPC **results** per colo, keyed by network + method + params, and only when the answer is immutable:
 *
 * - `boing_getBlockByHash`: content-addressed, cached a day once found.
 * - `boing_getBlockByHeight` / `boing_getTransactionReceipt`: cached a day once the height is at or below
 *   `finalized_height` (finalized blocks do not change). Newer heights are not cached.
 * - `boing_getContractCode`: installed code is immutable; cached 5 minutes once non-null.
 * - Tip reads (`boing_chainHeight`, `boing_getSyncState`, `boing_getNetworkInfo`): 2 second micro-cache, which
 *   collapses bursts from many viewers into one upstream call without making the tip visibly stale.
 *
 * Errors and null results are never cached. Outside Workers (`next dev`, tests) `caches.default` is absent and
 * everything passes through.
 */

export const TIP_TTL_SEC = 2;
export const IMMUTABLE_TTL_SEC = 86_400;
export const CODE_TTL_SEC = 300;

const TIP_METHODS = new Set(["boing_chainHeight", "boing_getSyncState", "boing_getNetworkInfo"]);
const FINALITY_METHODS = new Set(["boing_getBlockByHeight", "boing_getTransactionReceipt"]);

/** True when a method may ever be served from the cache (decides whether to look it up). */
export function isCacheCandidate(method: string): boolean {
  return (
    TIP_METHODS.has(method) ||
    FINALITY_METHODS.has(method) ||
    method === "boing_getBlockByHash" ||
    method === "boing_getContractCode"
  );
}

/** True when deciding the TTL for this method needs the finalized height. */
export function needsFinalizedHeight(method: string): boolean {
  return FINALITY_METHODS.has(method);
}

function heightOf(method: string, params: unknown[], result: unknown): number | null {
  if (method === "boing_getBlockByHeight") {
    const h = params[0];
    return typeof h === "number" && Number.isSafeInteger(h) && h >= 0 ? h : null;
  }
  if (method === "boing_getTransactionReceipt" && result && typeof result === "object") {
    const h = (result as { block_height?: unknown }).block_height;
    return typeof h === "number" && Number.isSafeInteger(h) && h >= 0 ? h : null;
  }
  return null;
}

/** Seconds to cache this successful result for (0 = do not cache). Pure. */
export function cacheTtlSeconds(
  method: string,
  params: unknown[],
  result: unknown,
  finalizedHeight: number | null,
): number {
  if (result === null || result === undefined) return 0;
  if (TIP_METHODS.has(method)) return TIP_TTL_SEC;
  if (method === "boing_getBlockByHash") return IMMUTABLE_TTL_SEC;
  if (method === "boing_getContractCode") return CODE_TTL_SEC;
  if (FINALITY_METHODS.has(method)) {
    const h = heightOf(method, params, result);
    if (h == null || finalizedHeight == null) return 0;
    return h <= finalizedHeight ? IMMUTABLE_TTL_SEC : 0;
  }
  return 0;
}

/** Synthetic GET URL used as the cache key (the Cache API only keys GET requests by URL). */
export function cacheKeyUrl(network: string, method: string, params: unknown[]): string {
  return `https://rpc-cache.boing.observer/v1/${encodeURIComponent(network)}/${encodeURIComponent(method)}?p=${encodeURIComponent(
    JSON.stringify(params),
  )}`;
}

type EdgeCache = {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
};

function edgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return c?.default ?? null;
}

/** Cached `result` for a request, or undefined on a miss / outside Workers. */
export async function readCachedResult(
  network: string,
  method: string,
  params: unknown[],
  cache: EdgeCache | null = edgeCache(),
): Promise<unknown | undefined> {
  if (!cache) return undefined;
  try {
    const hit = await cache.match(new Request(cacheKeyUrl(network, method, params)));
    if (!hit) return undefined;
    const body = (await hit.json()) as { result?: unknown };
    return body.result ?? undefined;
  } catch {
    return undefined;
  }
}

/** Store a result for `ttl` seconds. Never throws (a failed write just means the next request misses). */
export async function writeCachedResult(
  network: string,
  method: string,
  params: unknown[],
  result: unknown,
  ttl: number,
  cache: EdgeCache | null = edgeCache(),
): Promise<void> {
  if (!cache || ttl <= 0) return;
  try {
    await cache.put(
      new Request(cacheKeyUrl(network, method, params)),
      new Response(JSON.stringify({ result }), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` },
      }),
    );
  } catch {
    /* ignore */
  }
}
