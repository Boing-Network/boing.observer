/**
 * Boing JSON-RPC client (HTTP POST). No SDK required.
 * Base URL from config (e.g. NEXT_PUBLIC_TESTNET_RPC).
 * Defaults to public testnet when env is not set.
 * Transient failures (network error, 5xx, 429) are retried once after a short delay.
 * The same-origin `/api/rpc` proxy also failsover across hosted testnet backends.
 */

import type { JsonRpcRequest, JsonRpcResponse, NetworkId } from "./rpc-types";

const PUBLIC_TESTNET_RPC = "https://testnet-rpc.boing.network";

/** Hosted Fly origins used when the public hostname (or tunnel) is down. */
export const HOSTED_TESTNET_RPC_FALLBACKS = [
  "https://boing-testnet-1.fly.dev",
  "https://boing-testnet-2.fly.dev",
] as const;

const RPC_RETRY_DELAY_MS = 600;

let rpcId = 0;

function isRetryable(error: unknown, res?: Response): boolean {
  if (res) {
    if (res.status === 429) return true;
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
    throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as JsonRpcResponse<T>;
  if ("error" in data) {
    throw new Error(data.error.message || `RPC error ${data.error.code}`);
  }
  return data.result;
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
