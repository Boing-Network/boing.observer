/**
 * Boing RPC method wrappers for the explorer.
 */

import { rpcCall, getRpcBaseUrl } from "./rpc-client";
import type {
  Block,
  Account,
  BoingHealth,
  BoingNetworkInfo,
  BoingSyncState,
  ContractStorageWord,
  QaPoolConfigResult,
  QaPoolListResult,
  QaRegistryResult,
  RpcMethodCatalogResult,
  TransactionReceipt,
} from "./rpc-types";
import { normalizeHex64 } from "./rpc-types";

export type NetworkId = "testnet" | "mainnet";

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const rpcCache = new Map<string, CacheEntry<unknown>>();

function cachedRpc<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = rpcCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loader().catch((error) => {
    rpcCache.delete(key);
    throw error;
  });
  rpcCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  });
  return promise;
}

export async function fetchChainHeight(network: NetworkId): Promise<number> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_chainHeight`, 5_000, () =>
    rpcCall<number>(network, base, "boing_chainHeight", [])
  );
}

/** Committed chain tip: heights and latest block hash (see RPC-API-SPEC `boing_getSyncState`). */
export async function fetchSyncState(network: NetworkId): Promise<BoingSyncState> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_getSyncState`, 5_000, () =>
    rpcCall<BoingSyncState>(network, base, "boing_getSyncState", [])
  );
}

/** Liveness + build identity (`boing_health`). Returns `null` if the method is missing or errors. */
export async function tryFetchBoingHealth(network: NetworkId): Promise<BoingHealth | null> {
  const base = getRpcBaseUrl(network);
  try {
    return await rpcCall<BoingHealth>(network, base, "boing_health", []);
  } catch {
    return null;
  }
}

export async function fetchBlockByHeight(
  network: NetworkId,
  height: number,
  includeReceipts = false
): Promise<Block | null> {
  const base = getRpcBaseUrl(network);
  const cacheKey = `${base}:boing_getBlockByHeight:${height}:r${includeReceipts ? 1 : 0}`;
  const params = includeReceipts ? [height, true] : [height];
  return cachedRpc(cacheKey, 10_000, () =>
    rpcCall<Block | null>(network, base, "boing_getBlockByHeight", params)
  );
}

export async function fetchBlockByHash(
  network: NetworkId,
  hexBlockHash: string,
  includeReceipts = false
): Promise<Block | null> {
  const base = getRpcBaseUrl(network);
  const hash = hexBlockHash.startsWith("0x") ? hexBlockHash : `0x${hexBlockHash}`;
  const cacheKey = `${base}:boing_getBlockByHash:${hash}:r${includeReceipts ? 1 : 0}`;
  const params = includeReceipts ? [hash, true] : [hash];
  return cachedRpc(cacheKey, 10_000, () =>
    rpcCall<Block | null>(network, base, "boing_getBlockByHash", params)
  );
}

/** 32-byte transaction id (signable payload hash); same param as `boing_getTransactionReceipt`. */
export async function fetchTransactionReceipt(
  network: NetworkId,
  txIdHex: string
): Promise<TransactionReceipt | null> {
  const hex = normalizeHex64(txIdHex.trim());
  if (!hex) return null;
  const base = getRpcBaseUrl(network);
  const param = `0x${hex}`;
  return rpcCall<TransactionReceipt | null>(network, base, "boing_getTransactionReceipt", [param]);
}

export async function fetchAccount(
  network: NetworkId,
  hexAccountId: string
): Promise<Account> {
  const base = getRpcBaseUrl(network);
  const id = hexAccountId.startsWith("0x") ? hexAccountId : `0x${hexAccountId}`;
  return cachedRpc(`${base}:boing_getAccount:${id}`, 10_000, () =>
    rpcCall<Account>(network, base, "boing_getAccount", [id])
  );
}

export interface QaCheckResult {
  result: "allow" | "reject" | "unsure";
  rule_id?: string;
  message?: string;
  doc_url?: string;
}

export async function qaCheck(
  network: NetworkId,
  hexBytecode: string,
  purposeCategory?: string,
  descriptionHash?: string,
  assetName?: string,
  assetSymbol?: string
): Promise<QaCheckResult> {
  const base = getRpcBaseUrl(network);
  const params: string[] = [hexBytecode.startsWith("0x") ? hexBytecode : `0x${hexBytecode}`];
  if (purposeCategory != null && purposeCategory !== "") {
    params.push(purposeCategory);
    if (descriptionHash != null && descriptionHash !== "") {
      params.push(descriptionHash.startsWith("0x") ? descriptionHash : `0x${descriptionHash}`);
      if (assetName != null && assetName !== "") {
        params.push(assetName);
        if (assetSymbol != null && assetSymbol !== "") {
          params.push(assetSymbol);
        }
      }
    }
  }
  return rpcCall<QaCheckResult>(network, base, "boing_qaCheck", params);
}

export interface FaucetResult {
  ok: boolean;
  amount?: string;
  to?: string;
  message?: string;
}

export async function faucetRequest(
  network: NetworkId,
  hexAccountId: string
): Promise<FaucetResult> {
  const base = getRpcBaseUrl(network);
  const id = hexAccountId.startsWith("0x") ? hexAccountId : `0x${hexAccountId}`;
  return rpcCall<FaucetResult>(network, base, "boing_faucetRequest", [id]);
}

/** Live QA pool queue (public read). Short cache so the transparency page stays fresh. */
export async function fetchQaPoolList(network: NetworkId): Promise<QaPoolListResult> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_qaPoolList`, 12_000, () =>
    rpcCall<QaPoolListResult>(network, base, "boing_qaPoolList", [])
  );
}

/** Effective QA pool governance config and queue depth (public read). */
export async function fetchQaPoolConfig(network: NetworkId): Promise<QaPoolConfigResult> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_qaPoolConfig`, 12_000, () =>
    rpcCall<QaPoolConfigResult>(network, base, "boing_qaPoolConfig", [])
  );
}

/** Effective QA rule registry (read-only). Same shape as on-disk `qa_registry.json`. */
export async function fetchQaRegistry(network: NetworkId): Promise<QaRegistryResult> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_getQaRegistry`, 12_000, () =>
    rpcCall<QaRegistryResult>(network, base, "boing_getQaRegistry", [])
  );
}

/** Embedded JSON-RPC catalog from the node (see RPC-API-SPEC `boing_getRpcMethodCatalog`). */
export async function fetchRpcMethodCatalog(network: NetworkId): Promise<RpcMethodCatalogResult> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_getRpcMethodCatalog`, 300_000, () =>
    rpcCall<RpcMethodCatalogResult>(network, base, "boing_getRpcMethodCatalog", [])
  );
}

/** Chain metadata + consensus snapshot (see RPC-API-SPEC `boing_getNetworkInfo`). */
export async function fetchNetworkInfo(network: NetworkId): Promise<BoingNetworkInfo> {
  const base = getRpcBaseUrl(network);
  return cachedRpc(`${base}:boing_getNetworkInfo`, 15_000, () =>
    rpcCall<BoingNetworkInfo>(network, base, "boing_getNetworkInfo", [])
  );
}

const ZERO_STORAGE_KEY = `0x${"0".repeat(64)}` as const;

/**
 * Read one 32-byte storage word (`boing_getContractStorage`). Returns `null` on RPC failure
 * (e.g. method missing, account not a contract) so callers can treat as inconclusive.
 */
export async function tryFetchContractStorageWord(
  network: NetworkId,
  contractHex0x: string,
  keyHex0x: string = ZERO_STORAGE_KEY
): Promise<ContractStorageWord | null> {
  const base = getRpcBaseUrl(network);
  const c = contractHex0x.startsWith("0x") ? contractHex0x : `0x${contractHex0x}`;
  const k = keyHex0x.startsWith("0x") ? keyHex0x : `0x${keyHex0x}`;
  try {
    return await rpcCall<ContractStorageWord>(network, base, "boing_getContractStorage", [c, k]);
  } catch {
    return null;
  }
}
