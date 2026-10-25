/**
 * Wallet / dApp EIP-155–style chain IDs for Boing L1 (not read from block headers).
 * Chain IDs come from the vendored `docs/chain-metadata.json` (see chain-metadata.ts); internal network ids match boing.network THREE-CODEBASE-ALIGNMENT.md §3.
 */
import { networkMeta } from "./chain-metadata";
import type { NetworkId } from "./rpc-types";

export const BOING_TESTNET_CHAIN_ID_HEX = networkMeta("testnet").chain_id_hex;
export const BOING_TESTNET_CHAIN_ID_DECIMAL = networkMeta("testnet").chain_id;

export const BOING_MAINNET_CHAIN_ID_HEX = networkMeta("mainnet").chain_id_hex;
export const BOING_MAINNET_CHAIN_ID_DECIMAL = networkMeta("mainnet").chain_id;

/** Internal network id (portal / wallet / docs), not a JSON-RPC method. */
export const BOING_TESTNET_NETWORK_ID = "boing-testnet";
export const BOING_MAINNET_NETWORK_ID = "boing-mainnet";

export function boingNetworkId(network: NetworkId): string {
  return network === "mainnet" ? BOING_MAINNET_NETWORK_ID : BOING_TESTNET_NETWORK_ID;
}

/** Short label for the explorer UI (selected RPC network). */
export function boingChainIdLabel(network: NetworkId): string {
  if (network === "mainnet") {
    return `${BOING_MAINNET_CHAIN_ID_DECIMAL} · ${BOING_MAINNET_CHAIN_ID_HEX}`;
  }
  return `${BOING_TESTNET_CHAIN_ID_DECIMAL} · ${BOING_TESTNET_CHAIN_ID_HEX}`;
}
