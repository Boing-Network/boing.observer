import { normalizeHex64 } from "./rpc-types";

function withNetwork(path: string, network: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}network=${encodeURIComponent(network)}`;
}

/** Primary explorer URL for any 32-byte on-chain address (EOA, contract, token, NFT). */
export function explorerAssetHref(addressHex64: string, network: string): string {
  const h = normalizeHex64(addressHex64);
  if (!h) return "/";
  return withNetwork(`/asset/${h}`, network);
}

/** Account view (balances, nonce, transaction history) for a 32-byte AccountId. */
export function explorerAccountHref(addressHex64: string, network: string): string {
  const h = normalizeHex64(addressHex64);
  if (!h) return "/";
  return withNetwork(`/account/${h}`, network);
}

/** Signed transaction page. */
export function explorerTxHref(txIdHex64: string, network: string): string {
  const h = normalizeHex64(txIdHex64);
  if (!h) return "/";
  return withNetwork(`/tx/${h}`, network);
}

/** Block by height, optionally scrolled to a transaction slot. */
export function explorerBlockHeightHref(height: number, network: string, txIndex?: number): string {
  const path = withNetwork(`/block/${height}`, network);
  return typeof txIndex === "number" && Number.isInteger(txIndex) && txIndex >= 0
    ? `${path}#tx-${txIndex}`
    : path;
}

/** Block by header hash. */
export function explorerBlockHashHref(hashHex64: string, network: string): string {
  const h = normalizeHex64(hashHex64);
  if (!h) return "/";
  return withNetwork(`/block/hash/${h}`, network);
}
