/**
 * Read-only helpers for the on-chain linked NFT ↔ fungible token registry.
 * Query selectors: links_count (0xE3), get_link_at (0xE4). Tombstones (both ids zero) are skipped.
 * Write flows (claim / register / unlink) stay in FreshMint, boing.finance, and the SDK.
 *
 * Protocol: https://github.com/Boing-Network/boing.network/blob/main/docs/BOING-LINKED-NFT-TOKEN.md
 */

import type { createClient } from "boing-sdk";
import { CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX } from "@/lib/testnet-constants";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const SELECTOR_LINKED_NFT_TOKEN_LINKS_COUNT = 0xe3;
export const SELECTOR_LINKED_NFT_TOKEN_GET_LINK_AT = 0xe4;
export const LINKED_NFT_TOKEN_REGISTRY_MAX_SCAN = 4096;

const ZERO32 = `0x${"0".repeat(64)}`;

type BoingClient = ReturnType<typeof createClient>;

export type LinkedCompanionRole = "collection" | "fungible";

export type LinkedCompanionPeer = {
  /** Registry slot index. */
  index: number;
  /** Role of the peer relative to the queried asset. */
  peerRole: LinkedCompanionRole;
  /** Peer AccountId (0x-prefixed, lowercase). */
  peerId: string;
  /** NFT collection AccountId for this edge. */
  collectionId: string;
  /** Fungible token AccountId for this edge. */
  tokenId: string;
};

function selectorWord(selector: number): Uint8Array {
  const w = new Uint8Array(32);
  w[31] = selector & 0xff;
  return w;
}

function u64Word(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("index must be a non-negative safe integer");
  }
  const w = new Uint8Array(32);
  new DataView(w.buffer).setBigUint64(24, BigInt(n), false);
  return w;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "0x";
  for (let i = 0; i < bytes.length; i += 1) s += bytes[i]!.toString(16).padStart(2, "0");
  return s;
}

function concatWords(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** `links_count` calldata (32 bytes). */
export function encodeLinkedNftTokenLinksCountCalldataHex(): string {
  return bytesToHex(selectorWord(SELECTOR_LINKED_NFT_TOKEN_LINKS_COUNT));
}

/** `get_link_at(index)` calldata (64 bytes). */
export function encodeLinkedNftTokenGetLinkAtCalldataHex(index: number): string {
  return bytesToHex(concatWords([selectorWord(SELECTOR_LINKED_NFT_TOKEN_GET_LINK_AT), u64Word(index)]));
}

export function decodeLinkedNftTokenLinksCountReturnData(returnDataHex: string): bigint {
  const raw = String(returnDataHex || "")
    .replace(/^0x/i, "")
    .toLowerCase();
  if (raw.length < 16) return BigInt(0);
  return BigInt(`0x${raw.slice(-16)}`);
}

export function decodeLinkedNftTokenGetLinkAtReturnData(returnDataHex: string): {
  collectionHex: string;
  tokenHex: string;
  /** False when both ids are zero (tombstone / unlinked slot). */
  active: boolean;
} {
  const raw = String(returnDataHex || "")
    .replace(/^0x/i, "")
    .toLowerCase();
  if (raw.length < 128) {
    throw new Error("get_link_at return data: expected 64 bytes");
  }
  const collectionHex = `0x${raw.slice(0, 64)}`;
  const tokenHex = `0x${raw.slice(64, 128)}`;
  return {
    collectionHex,
    tokenHex,
    active: collectionHex !== ZERO32 && tokenHex !== ZERO32,
  };
}

function normalizeAccountId(hex: string | null | undefined): string | null {
  if (hex == null || hex === "") return null;
  const body = String(hex).trim().replace(/^0x/i, "");
  const n = normalizeHex64(body);
  if (!n) return null;
  const lower = `0x${n}`;
  if (lower === ZERO32) return null;
  return lower;
}

/**
 * Resolve registry AccountId: env → network_info end_user → testnet canonical default.
 */
export function resolveLinkedNftTokenRegistryId(opts?: {
  network?: NetworkId;
  endUser?: Record<string, unknown> | null;
  envRegistryHex?: string | null;
}): { registryId: string | null; source: "env" | "network_info" | "testnet_canonical" | null } {
  const fromEnv = normalizeAccountId(
    opts?.envRegistryHex ??
      process.env.NEXT_PUBLIC_BOING_LINKED_NFT_TOKEN_REGISTRY ??
      process.env.BOING_LINKED_NFT_TOKEN_REGISTRY ??
      null,
  );
  if (fromEnv) return { registryId: fromEnv, source: "env" };

  const endUser = opts?.endUser;
  if (endUser && typeof endUser === "object") {
    const candidates = [
      endUser.canonical_linked_nft_token_registry,
      endUser.canonical_native_linked_nft_token_registry,
      endUser.linked_nft_token_registry,
    ];
    for (const c of candidates) {
      const id = normalizeAccountId(typeof c === "string" ? c : null);
      if (id) return { registryId: id, source: "network_info" };
    }
  }

  if (opts?.network === "testnet" || opts?.network == null) {
    const canon = normalizeAccountId(CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX);
    if (canon) return { registryId: canon, source: "testnet_canonical" };
  }

  return { registryId: null, source: null };
}

async function simulateReturnData(
  client: BoingClient,
  registryId: string,
  calldata: string,
): Promise<string | null> {
  const sim = await client.simulateContractCall(registryId, calldata);
  if (!sim?.success) return null;
  const rd = sim.return_data;
  return typeof rd === "string" && rd.length > 0 ? rd : null;
}

/**
 * Scan registry slots for active edges involving `assetId` (collection or fungible side).
 * Skips tombstones. Caps scan at {@link LINKED_NFT_TOKEN_REGISTRY_MAX_SCAN}.
 */
export async function listLinkedCompanionsForAsset(opts: {
  client: BoingClient;
  registryId: string;
  assetId: string;
  maxScan?: number;
}): Promise<{ companions: LinkedCompanionPeer[]; slotCount: number }> {
  const asset = normalizeAccountId(opts.assetId);
  if (!asset) return { companions: [], slotCount: 0 };

  const countData = await simulateReturnData(
    opts.client,
    opts.registryId,
    encodeLinkedNftTokenLinksCountCalldataHex(),
  );
  if (!countData) return { companions: [], slotCount: 0 };

  let count = Number(decodeLinkedNftTokenLinksCountReturnData(countData));
  if (!Number.isFinite(count) || count < 0) count = 0;
  const maxScan = opts.maxScan ?? LINKED_NFT_TOKEN_REGISTRY_MAX_SCAN;
  if (count > maxScan) count = maxScan;

  const companions: LinkedCompanionPeer[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = await simulateReturnData(
      opts.client,
      opts.registryId,
      encodeLinkedNftTokenGetLinkAtCalldataHex(i),
    );
    if (!at) continue;
    let decoded: ReturnType<typeof decodeLinkedNftTokenGetLinkAtReturnData>;
    try {
      decoded = decodeLinkedNftTokenGetLinkAtReturnData(at);
    } catch {
      continue;
    }
    if (!decoded.active) continue;
    const collectionId = decoded.collectionHex.toLowerCase();
    const tokenId = decoded.tokenHex.toLowerCase();
    if (collectionId === asset) {
      companions.push({
        index: i,
        peerRole: "fungible",
        peerId: tokenId,
        collectionId,
        tokenId,
      });
    } else if (tokenId === asset) {
      companions.push({
        index: i,
        peerRole: "collection",
        peerId: collectionId,
        collectionId,
        tokenId,
      });
    }
  }

  return { companions, slotCount: count };
}
