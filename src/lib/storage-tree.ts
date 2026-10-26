/**
 * Contract storage-tree version by block height ("storage-tree v2", full-key routing).
 *
 * Upstream (boing.network `docs/STORAGE-TREE-V2-ACTIVATION.md`): from the consensus-wide activation height H,
 * per-contract storage trees route on all 256 key bits; below H they route on 64 bits (colliding keys: only the
 * smallest is committed). The proof format is unchanged, v2 proofs are just longer. Anything that recomputes a
 * contract storage root must use the routing that matches the block height.
 *
 * H is configured on the node (`BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT`, OFF when unset). Newer nodes publish it as
 * `storage_tree_v2_activation_height` in `boing_getNetworkInfo` (a number, or `null` when v2 is not scheduled); older
 * nodes publish nothing. The explorer never guesses: with neither the node value nor the optional build mirror
 * `NEXT_PUBLIC_BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT` it reports "unknown" and tolerates both layouts.
 * Precedence: node info > build env > unknown.
 */

import { findNodeInfoField } from "./node-info-fields";

/** A height, `"off"` (node says v2 is not scheduled) or `null` (unknown). */
export type StorageActivation = number | "off" | null;

export type StorageTreeMode = "legacy-64bit" | "v2-256bit" | "unknown";

/** A non-negative safe integer, or `null` for anything else (unset, empty, "off", negative, fractional). */
export function parseActivationHeight(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!/^\d{1,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** Build-time mirror of the node's activation height (literal access so Next inlines it). */
export function configuredStorageTreeV2ActivationHeight(): number | null {
  return parseActivationHeight(process.env.NEXT_PUBLIC_BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT);
}

const NODE_INFO_KEY = "storage_tree_v2_activation_height";

/**
 * `storage_tree_v2_activation_height` from node info: a height, `"off"` when the key is present with `null`
 * (v2 not scheduled), or `null` when the key is absent / malformed (older node: unknown).
 */
export function readActivationFromNodeInfo(info: unknown): StorageActivation {
  const f = findNodeInfoField(info, NODE_INFO_KEY);
  if (!f.found) return null;
  if (f.value === null) return "off";
  return parseActivationHeight(f.value);
}

/** Node info first, then the build mirror, else unknown. */
export function resolveStorageActivation(info: unknown): StorageActivation {
  return readActivationFromNodeInfo(info) ?? configuredStorageTreeV2ActivationHeight();
}

export function storageTreeModeAt(height: number, activation: StorageActivation): StorageTreeMode {
  if (activation == null) return "unknown";
  if (activation === "off") return "legacy-64bit";
  return height >= activation ? "v2-256bit" : "legacy-64bit";
}

export function describeStorageTree(height: number, activation: StorageActivation): string {
  switch (storageTreeModeAt(height, activation)) {
    case "v2-256bit":
      return `Contract storage trees at this height route on 256 bits (storage-tree v2, active from height ${activation}). Proofs are longer; the proof format is unchanged.`;
    case "legacy-64bit":
      return activation === "off"
        ? "Contract storage trees route on 64 bits (legacy): this node reports that storage-tree v2 is not scheduled."
        : `Contract storage trees at this height route on 64 bits (legacy; storage-tree v2 activates at height ${activation}).`;
    default:
      return "This node does not report a storage-tree v2 activation height, so this explorer cannot tell which routing applies at this height. Account proofs verify the same way under either layout.";
  }
}