/**
 * Request policy for the same-origin `/api/rpc` proxy (kept out of `route.ts`: Next route modules may only
 * export handlers/config). Pure and unit-tested; the route handles transport (failover, size caps, timeouts).
 */

/** Methods the explorer browser client may invoke via the proxy. Everything else gets JSON-RPC -32601. */
export const ALLOWED_RPC_METHODS: ReadonlySet<string> = new Set([
  "boing_chainHeight",
  "boing_getSyncState",
  "boing_health",
  "boing_getBlockByHeight",
  "boing_getBlockByHash",
  "boing_getTransactionReceipt",
  "boing_getAccount",
  "boing_getNetworkInfo",
  "boing_getNetworkFeePolicy",
  "boing_getContractCode",
  "boing_getContractStorage",
  // Account Merkle proofs (read-only; verification is a pure check of caller-supplied bytes)
  "boing_getAccountProof",
  "boing_verifyAccountProof",
  "boing_getQaRegistry",
  "boing_qaPoolList",
  "boing_qaPoolConfig",
  "boing_getRpcMethodCatalog",
  "boing_qaCheck",
  "boing_faucetRequest",
  // .boing name registry (read-only)
  "boing_resolveName",
  "boing_reverseName",
  "boing_getNameInfo",
  "boing_checkNames",
  "boing_namesOwnedBy",
  "boing_simulateContractCall",
  // Media blob metadata (bytes stay on gated /api/blob/download - not this proxy)
  "boing_getBlobMeta",
]);

/** Largest `params` array any allowed method takes (simulateContractCall / qaCheck are the widest). */
export const MAX_RPC_PARAMS = 8;
const METHOD_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export type ProxyRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

export type ProxyValidation =
  | { ok: true; request: ProxyRequest }
  | { ok: false; kind: "invalid"; error: string; id: number }
  | { ok: false; kind: "method_not_allowed"; method: string; id: number };

/**
 * Validate a parsed body. Single requests only (batches are rejected: the browser never needs them and they
 * multiply upstream load). Only `{jsonrpc, id, method, params}` are forwarded, so unknown members cannot
 * reach the node. `id` is coerced to a safe integer (the client always sends a counter).
 */
export function validateProxyRequest(body: unknown): ProxyValidation {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, kind: "invalid", error: "Invalid JSON-RPC 2.0 request", id: 0 };
  }
  const b = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  const id = typeof b.id === "number" && Number.isSafeInteger(b.id) ? b.id : 0;
  if (b.jsonrpc !== "2.0" || typeof b.method !== "string" || !METHOD_RE.test(b.method)) {
    return { ok: false, kind: "invalid", error: "Invalid JSON-RPC 2.0 request", id };
  }
  if (!ALLOWED_RPC_METHODS.has(b.method)) {
    return { ok: false, kind: "method_not_allowed", method: b.method, id };
  }
  const params = b.params === undefined ? [] : b.params;
  if (!Array.isArray(params) || params.length > MAX_RPC_PARAMS) {
    return {
      ok: false,
      kind: "invalid",
      error: `params must be an array of at most ${MAX_RPC_PARAMS} items`,
      id,
    };
  }
  return { ok: true, request: { jsonrpc: "2.0", id, method: b.method, params } };
}
