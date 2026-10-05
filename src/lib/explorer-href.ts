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

/**
 * Individual minted reference NFT profile: collection AccountId + opaque 32-byte token id word.
 * Token ids may be sequential (low u64) or FreshMint-style hash words.
 */
export function explorerNftItemHref(
  collectionHex64: string,
  tokenIdHex64: string,
  network: string,
): string {
  const collection = normalizeHex64(collectionHex64);
  const tokenId = normalizeHex64(tokenIdHex64);
  if (!collection || !tokenId) return "/";
  return withNetwork(`/asset/${collection}/item/${tokenId}`, network);
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
