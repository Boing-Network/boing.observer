import { CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX } from "@boing-network/boing-sdk";
import { resolveContractCode, type ContractCodeLookup } from "@/lib/contract-code-lookup";
import { applyPublishedInterface, identifyContract, type IdentifiedContract, type PublishedInfo } from "@/lib/contract-identify";
import { resolvePublishedInterface } from "@/lib/published-interface";
import { getRpcBaseUrl, rpcCall } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

export type ContractInterfaceResponse = IdentifiedContract & {
  calledAsContract: boolean;
  callCount: number;
  historyUnsupported?: boolean;
  published?: PublishedInfo;
};

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: ContractInterfaceResponse }>();

/**
 * Identify a contract (canonical table, exact template bytecode, dispatch selectors, published interface).
 * Shared by `/api/contract/interface` and `/api/tx/context`; results are cached for 10 minutes per isolate.
 */
export async function resolveContractInterface(network: NetworkId, address64: string): Promise<ContractInterfaceResponse> {
  const key = `${network}:${address64}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const base = getRpcBaseUrl(network);
  const rpc = <T,>(method: string, params: unknown[]) => rpcCall<T>(network, base, method, params);
  let lookup: ContractCodeLookup;
  try {
    lookup = await resolveContractCode(rpc, address64, {
      extraDeployers: network === "testnet" ? [CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX] : [],
    });
  } catch {
    lookup = { calledAsContract: false, callCount: 0, code: null };
  }
  let published: Awaited<ReturnType<typeof resolvePublishedInterface>> = null;
  if (network === "testnet") {
    try {
      published = await resolvePublishedInterface(rpc, address64, { knownDeployer: lookup.code?.deployer ?? null });
    } catch {
      published = null;
    }
  }
  const value: ContractInterfaceResponse = {
    ...applyPublishedInterface(identifyContract({ network, address64, code: lookup.code }), published),
    calledAsContract: lookup.calledAsContract,
    callCount: lookup.callCount,
    ...(lookup.historyUnsupported ? { historyUnsupported: true } : {}),
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
