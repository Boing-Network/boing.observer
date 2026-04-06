import "server-only";

import { createClient } from "boing-sdk";
import { getRpcBaseUrl } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

/** Server-side JSON-RPC client (direct to configured node; no browser CORS). */
export function createServerBoingClient(network: NetworkId) {
  const baseUrl = getRpcBaseUrl(network);
  return createClient({
    baseUrl,
    timeoutMs: 120_000,
    maxRetries: 1,
  });
}
