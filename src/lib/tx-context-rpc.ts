/**
 * Extra context for `/api/tx/context`, read straight from the node:
 *
 *  - Token metadata for EVERY token (not only DEX pool tokens) via `boing_getTokenMetadata`
 *    (boing.network `docs/RPC-API-SPEC.md`). Older nodes, and the public gateway until its allow-list is
 *    redeployed, do not have the method: the caller then keeps the DEX-directory behaviour
 *    (`boing_listDexTokens`), and this module remembers that for a while instead of retrying on every request.
 *  - The pool and token pair of an LP vault v2 (storage slots 0xe2..0xe4, `native_lp_vault_v2.rs`).
 *
 * The published `@boing-network/boing-sdk` (0.5.38) predates `getTokenMetadata`, so these are raw JSON-RPC calls.
 */

import { getRpcBaseUrl, getTestnetRpcCandidates, rpcCall } from "./rpc-client";
import type { NetworkId } from "./rpc-types";
import type { TokenMeta, VaultMeta } from "./tx-decode";

export type RpcCaller = (method: string, params: unknown[]) => Promise<unknown>;

const HEX64 = /^[0-9a-f]{64}$/;
const ZERO64 = "0".repeat(64);
const CALL_TIMEOUT_MS = 8_000;
const TOKEN_TTL_MS = 5 * 60_000;
const VAULT_TTL_MS = 10 * 60_000;
/** The node does not have the method (old binary, or the gateway allow-list lacks it). */
const UNSUPPORTED_BACKOFF_MS = 10 * 60_000;
/** Any other failure (timeout, 5xx): try again soon. */
const TRANSIENT_BACKOFF_MS = 30_000;
/** Lookups per request; the context route is hit for every transaction row. */
export const MAX_TOKEN_LOOKUPS = 12;

/** Server RPC caller: configured primary, then the hosted fallbacks (testnet), each with a hard timeout. */
export function createRpcCaller(network: NetworkId): RpcCaller {
  const bases = network === "testnet" ? getTestnetRpcCandidates() : [getRpcBaseUrl(network)];
  return async (method, params) => {
    let last: unknown;
    for (const base of bases) {
      try {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${method} timed out`)), CALL_TIMEOUT_MS);
        });
        try {
          return await Promise.race([rpcCall<unknown>(network, base, method, params), timeout]);
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error(`${method} failed`);
  };
}

/** Pure: a `boing_getTokenMetadata` result as the decoder's `TokenMeta`; null when it carries nothing. */
export function tokenMetaFromRpc(r: unknown): TokenMeta | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const decimals = typeof o.decimals === "number" && Number.isInteger(o.decimals) && o.decimals >= 0 && o.decimals <= 255 ? o.decimals : null;
  const meta: TokenMeta = { symbol: str(o.symbol), name: str(o.name), decimals };
  return meta.symbol || meta.name || meta.decimals != null ? meta : null;
}

/** Pure: the chain's own answer wins where it has one; the DEX directory fills the gaps. */
export function mergeTokenMeta(dex: TokenMeta | undefined, rpc: TokenMeta | null): TokenMeta | undefined {
  if (!rpc) return dex;
  if (!dex) return rpc;
  return {
    symbol: rpc.symbol ?? dex.symbol,
    name: rpc.name ?? dex.name,
    decimals: rpc.decimals ?? dex.decimals,
  };
}

function isUnsupported(e: unknown): boolean {
  const x = e as { code?: number | null; httpStatus?: number | null } | null;
  return x?.code === -32601 || x?.httpStatus === 403 || x?.httpStatus === 404 || x?.httpStatus === 405 || x?.httpStatus === 501;
}

const tokenCache = new Map<string, { at: number; meta: TokenMeta | null }>();
const backoffUntil = new Map<NetworkId, number>();
const vaultCache = new Map<string, { at: number; meta: VaultMeta | null }>();

/** Test hook. */
export function resetTxContextRpcCaches(): void {
  tokenCache.clear();
  backoffUntil.clear();
  vaultCache.clear();
}

/**
 * `boing_getTokenMetadata` for each id (cached, capped). Returns only ids the node knows as tokens. Resolves to `{}`
 * (never throws) when the node lacks the method or the call fails, so callers fall back to the DEX directory.
 */
export async function fetchTokenMetadata(
  network: NetworkId,
  ids: string[],
  call: RpcCaller = createRpcCaller(network),
  now: () => number = Date.now,
): Promise<Record<string, TokenMeta>> {
  const out: Record<string, TokenMeta> = {};
  const todo: string[] = [];
  for (const id of ids) {
    if (!HEX64.test(id) || id in out) continue;
    const hit = tokenCache.get(`${network}:${id}`);
    if (hit && now() - hit.at < TOKEN_TTL_MS) {
      if (hit.meta) out[id] = hit.meta;
      continue;
    }
    if (!todo.includes(id)) todo.push(id);
  }
  const lookups = todo.slice(0, MAX_TOKEN_LOOKUPS);
  if (lookups.length === 0 || now() < (backoffUntil.get(network) ?? 0)) return out;

  const one = async (id: string): Promise<void> => {
    const meta = tokenMetaFromRpc(await call("boing_getTokenMetadata", [{ id: `0x${id}` }]));
    tokenCache.set(`${network}:${id}`, { at: now(), meta });
    if (meta) out[id] = meta;
  };
  try {
    // Probe with one id first: on a node without the method, one failed call is enough.
    await one(lookups[0]!);
  } catch (e) {
    backoffUntil.set(network, now() + (isUnsupported(e) ? UNSUPPORTED_BACKOFF_MS : TRANSIENT_BACKOFF_MS));
    return out;
  }
  await Promise.all(
    lookups.slice(1).map((id) =>
      one(id).catch(() => {
        /* one id failing must not lose the rest; it is retried on the next request */
      }),
    ),
  );
  return out;
}

const slotKey = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

async function readWord(call: RpcCaller, contract: string, slot: number): Promise<string> {
  const r = (await call("boing_getContractStorage", [`0x${contract}`, slotKey(slot)])) as { value?: unknown } | null;
  const v = typeof r?.value === "string" ? r.value.replace(/^0x/i, "").toLowerCase().padStart(64, "0") : ZERO64;
  return HEX64.test(v) ? v : ZERO64;
}

/** Pool and token pair of an LP vault v2 (null when the vault is not configured yet). Errors propagate. */
export async function fetchVaultMeta(
  network: NetworkId,
  vault: string,
  call: RpcCaller = createRpcCaller(network),
  now: () => number = Date.now,
): Promise<VaultMeta | null> {
  const key = `${network}:${vault}`;
  const hit = vaultCache.get(key);
  if (hit && now() - hit.at < VAULT_TTL_MS) return hit.meta;
  const [pool, tokenA, tokenB] = await Promise.all([readWord(call, vault, 0xe2), readWord(call, vault, 0xe3), readWord(call, vault, 0xe4)]);
  const meta = pool === ZERO64 || tokenA === ZERO64 || tokenB === ZERO64 ? null : { pool, tokenA, tokenB };
  // A vault that is not configured yet is re-read soon rather than cached for ten minutes.
  vaultCache.set(key, { at: meta ? now() : now() - VAULT_TTL_MS + 15_000, meta });
  return meta;
}
