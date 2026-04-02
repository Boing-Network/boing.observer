/**
 * Wallet / dApp EIP-155–style chain IDs for Boing L1 (not read from block headers).
 * @see https://github.com/chiku524/boing.network/blob/main/docs/THREE-CODEBASE-ALIGNMENT.md §3
 */
import type { NetworkId } from "./rpc-types";

export const BOING_TESTNET_CHAIN_ID_HEX = "0x1b01";
export const BOING_TESTNET_CHAIN_ID_DECIMAL = 6913;

export const BOING_MAINNET_CHAIN_ID_HEX = "0x1b02";
export const BOING_MAINNET_CHAIN_ID_DECIMAL = 6914;

/** Short label for the explorer UI (selected RPC network). */
export function boingChainIdLabel(network: NetworkId): string {
  if (network === "mainnet") {
    return `${BOING_MAINNET_CHAIN_ID_DECIMAL} · ${BOING_MAINNET_CHAIN_ID_HEX}`;
  }
  return `${BOING_TESTNET_CHAIN_ID_DECIMAL} · ${BOING_TESTNET_CHAIN_ID_HEX}`;
}
