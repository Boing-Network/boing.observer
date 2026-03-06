/**
 * Boing JSON-RPC client (HTTP POST). No SDK required.
 * Base URL from config (e.g. NEXT_PUBLIC_TESTNET_RPC).
 * Defaults to public testnet when env is not set.
 */

import type { JsonRpcRequest, JsonRpcResponse } from "./rpc-types";

const PUBLIC_TESTNET_RPC = "https://testnet-rpc.boing.network";

let rpcId = 0;

export async function rpcCall<T>(
  baseUrl: string,
  method: string,
  params: unknown[] = []
): Promise<T> {
  const req: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: ++rpcId,
    method,
    params,
  };

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as JsonRpcResponse<T>;
  if ("error" in data) {
    throw new Error(data.error.message || `RPC error ${data.error.code}`);
  }
  return data.result;
}

export function getConfiguredRpcUrls() {
  const testnet = process.env.NEXT_PUBLIC_TESTNET_RPC || PUBLIC_TESTNET_RPC;
  const mainnet = process.env.NEXT_PUBLIC_MAINNET_RPC || "";

  return {
    testnet: testnet.replace(/\/$/, ""),
    mainnet: mainnet.replace(/\/$/, ""),
  };
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
