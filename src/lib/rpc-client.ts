/**
 * Boing JSON-RPC client (HTTP POST). No SDK required.
 * Base URL from config (e.g. NEXT_PUBLIC_TESTNET_RPC).
 * Defaults to public testnet when env is not set.
 * Transient failures (network error, 5xx, 429) are retried once after a short delay.
 * The same-origin `/api/rpc` proxy also failsover across hosted testnet backends.
 */

import { BoingRpcCallError } from "./rpc-error";
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcSuccess, NetworkId } from "./rpc-types";

const PUBLIC_TESTNET_RPC = "https://testnet-rpc.boing.network";

/** Hosted Fly origins used when the public hostname (or tunnel) is down. */
export const HOSTED_TESTNET_RPC_FALLBACKS = [
  "https://boing-testnet-1.fly.dev",
] as const;

const RPC_RETRY_DELAY_MS = 600;

let rpcId = 0;

function isRetryable(error: unknown, res?: Response): boolean {
  if (res) {
    if (res.status === 429) {
      // Honour the proxy's Retry-After: do not hammer a limiter that asked for a longer pause.
      const wait = Number(res.headers.get("retry-after"));
      return !(Number.isFinite(wait) && wait > 1);
    }
    if (res.status >= 500 && res.status < 600) return true;
  }
  if (error instanceof TypeError && (error.message === "Failed to fetch" || error.message.includes("network"))) return true;
  return false;
}

export async function rpcCall<T>(
  network: NetworkId,
  baseUrl: string,
  method: string,
  params: unknown[] = [],
  isRetry = false
): Promise<T> {
  const req: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: ++rpcId,
    method,
    params,
  };

  const useSameOriginProxy = typeof window !== "undefined";

  let res: Response;
  try {
    res = useSameOriginProxy
      ? await fetch("/api/rpc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Boing-RPC-Network": network,
          },
          body: JSON.stringify(req),
        })
      : await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
  } catch (err) {
    if (!isRetry && isRetryable(err)) {
      await new Promise((r) => setTimeout(r, RPC_RETRY_DELAY_MS));
      return rpcCall<T>(network, baseUrl, method, params, true);
    }
    throw err;
  }

  if (!res.ok) {
    if (!isRetry && isRetryable(null, res)) {
      await new Promise((r) => setTimeout(r, RPC_RETRY_DELAY_MS));
      return rpcCall<T>(network, baseUrl, method, params, true);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    throw new BoingRpcCallError(`RPC HTTP ${res.status}: ${res.statusText}`, {
      method,
      httpStatus: res.status,
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    });
  }

  let data: JsonRpcResponse<T>;
  try {
    data = (await res.json()) as JsonRpcResponse<T>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new BoingRpcCallError(
      `RPC returned invalid JSON (${detail}). Often a truncated oversized block response.`,
      { method, httpStatus: res.status },
    );
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    // Keep the node's numeric `code` and structured `data` (e.g. data.reason) for callers and UI.
    throw new BoingRpcCallError(data.error.message || `RPC error ${data.error.code}`, {
      code: typeof data.error.code === "number" ? data.error.code : null,
      data: (data.error as { data?: unknown }).data,
      method,
    });
  }
  return (data as JsonRpcSuccess<T>).result;
}

function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function getConfiguredRpcUrls() {
  const testnet = process.env.NEXT_PUBLIC_TESTNET_RPC || PUBLIC_TESTNET_RPC;
  const mainnet = process.env.NEXT_PUBLIC_MAINNET_RPC || "";

  return {
    testnet: stripSlash(testnet),
    mainnet: stripSlash(mainnet),
  };
}

/**
 * Testnet RPC origins to try in order: configured primary, optional env fallbacks,
 * then the hosted Fly cluster. Deduped. Used by the same-origin proxy.
 */
export function getTestnetRpcCandidates(): string[] {
  const primary = getConfiguredRpcUrls().testnet;
  const extra = (process.env.NEXT_PUBLIC_TESTNET_RPC_FALLBACKS || "")
    .split(",")
    .map((s) => stripSlash(s.trim()))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [primary, ...extra, ...HOSTED_TESTNET_RPC_FALLBACKS]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function isMainnetConfigured(): boolean {
  const { testnet, mainnet } = getConfiguredRpcUrls();
  return Boolean(mainnet) && mainnet !== testnet;
}

export function getRpcBaseUrl(network: "testnet" | "mainnet"): string {
  const { testnet, mainnet } = getConfiguredRpcUrls();

  if (network === "mainnet") {
    if (!isMainnetConfigured()) {
      throw new Error("Mainnet RPC is not configured yet.");
    }
    return mainnet;
  }

  return testnet;
}
