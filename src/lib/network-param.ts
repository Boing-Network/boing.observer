import type { NetworkId } from "./rpc-types";

/** localStorage key holding the last explicitly chosen network. */
export const NETWORK_STORAGE_KEY = "boing-explorer-network";

/** Parses a `?network=` value. Anything other than `testnet` / `mainnet` (case-insensitive) is ignored. */
export function parseNetworkParam(value: string | null | undefined): NetworkId | null {
  const v = (value ?? "").trim().toLowerCase();
  return v === "testnet" || v === "mainnet" ? v : null;
}

export type InitialNetworkResolution = {
  network: NetworkId;
  /** Where the winning value came from. A deep link (`url`) always beats the stored preference. */
  source: "url" | "stored" | "default";
  /** Set when a link asked for a network this deployment cannot serve (mainnet RPC not configured). */
  unavailable: NetworkId | null;
};

/**
 * Picks the network on first load. Priority: `?network=` (wallet / dApp deep links) > stored preference > testnet.
 * `mainnet` is only honoured when a distinct mainnet RPC is configured; otherwise we fall back to testnet and
 * report `unavailable` so the UI can say so instead of silently showing the wrong chain.
 */
export function resolveInitialNetwork(input: {
  search: string;
  stored: string | null;
  mainnetConfigured: boolean;
}): InitialNetworkResolution {
  const fromUrl = parseNetworkParam(new URLSearchParams(input.search).get("network"));
  if (fromUrl) {
    if (fromUrl === "mainnet" && !input.mainnetConfigured) {
      return { network: "testnet", source: "url", unavailable: "mainnet" };
    }
    return { network: fromUrl, source: "url", unavailable: null };
  }
  const stored = parseNetworkParam(input.stored);
  if (stored === "mainnet" && input.mainnetConfigured) return { network: "mainnet", source: "stored", unavailable: null };
  if (stored === "testnet") return { network: "testnet", source: "stored", unavailable: null };
  return { network: "testnet", source: "default", unavailable: null };
}

/**
 * Returns `search` with `network` updated, but only when the URL already carried a `network` param, so a
 * stale deep link does not point at the previous chain after the user switches networks. Returns null when
 * no change is needed.
 */
export function syncNetworkInSearch(search: string, network: NetworkId): string | null {
  const params = new URLSearchParams(search);
  if (!params.has("network") || params.get("network") === network) return null;
  params.set("network", network);
  const out = params.toString();
  return out ? `?${out}` : "";
}