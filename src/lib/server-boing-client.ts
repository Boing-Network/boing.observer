import "server-only";

import { createClient } from "@boing-network/boing-sdk";
import { getRpcBaseUrl, getTestnetRpcCandidates } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

/** Server-side JSON-RPC client (direct to configured node; no browser CORS). */
export function createServerBoingClient(network: NetworkId, baseUrl?: string) {
  const url = baseUrl ?? getRpcBaseUrl(network);
  return createClient({
    baseUrl: url,
    timeoutMs: 120_000,
    maxRetries: 1,
  });
}

/**
 * Prefer the configured primary RPC, then testnet Fly fallbacks when the public
 * gateway is blocked (e.g. Cloudflare challenge). Runs `probe` until one succeeds.
 */
export async function withServerBoingClientFailover<T>(
  network: NetworkId,
  probe: (client: ReturnType<typeof createClient>) => Promise<T>,
): Promise<T> {
  const bases =
    network === "testnet" ? getTestnetRpcCandidates() : [getRpcBaseUrl(network)];
  let lastError: unknown;
  for (const baseUrl of bases) {
    try {
      return await probe(createServerBoingClient(network, baseUrl));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All RPC candidates failed");
}
