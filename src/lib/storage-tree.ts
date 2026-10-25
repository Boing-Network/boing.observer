/**
 * Contract storage-tree version by block height ("storage-tree v2", full-key routing).
 *
 * Upstream (boing.network `docs/STORAGE-TREE-V2-ACTIVATION.md`): from the consensus-wide activation height H,
 * per-contract storage trees route on all 256 key bits; below H they route on 64 bits (colliding keys: only the
 * smallest is committed). The proof format is unchanged, v2 proofs are just longer. Anything that recomputes a
 * contract storage root must use the routing that matches the block height.
 *
 * H is configured on the node (`BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT`, OFF when unset) and is NOT published
 * over JSON-RPC today. The explorer therefore never guesses: with no known activation height it reports
 * "unknown" and tolerates both layouts. Operators can mirror the node value into the build with
 * `NEXT_PUBLIC_BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT`, and {@link readActivationFromNodeInfo} will pick the
 * value up from node info automatically if a node ever publishes it.
 */

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
 * Forward-compatible: `storage_tree_v2_activation_height` at the top level of node info, or one object level
 * down (for example under a `state` / `consensus` block). Returns `null` when absent, which is the case on
 * every node today.
 */
export function readActivationFromNodeInfo(info: unknown): number | null {
  if (!info || typeof info !== "object" || Array.isArray(info)) return null;
  const rec = info as Record<string, unknown>;
  const direct = parseActivationHeight(rec[NODE_INFO_KEY]);
  if (direct != null) return direct;
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = parseActivationHeight((v as Record<string, unknown>)[NODE_INFO_KEY]);
      if (nested != null) return nested;
    }
  }
  return null;
}

export function storageTreeModeAt(height: number, activationHeight: number | null): StorageTreeMode {
  if (activationHeight == null) return "unknown";
  return height >= activationHeight ? "v2-256bit" : "legacy-64bit";
}

export function describeStorageTree(height: number, activationHeight: number | null): string {
  switch (storageTreeModeAt(height, activationHeight)) {
    case "v2-256bit":
      return `Contract storage trees at this height route on 256 bits (storage-tree v2, active from height ${activationHeight}). Proofs are longer; the proof format is unchanged.`;
    case "legacy-64bit":
      return `Contract storage trees at this height route on 64 bits (legacy; storage-tree v2 activates at height ${activationHeight}).`;
    default:
      return "Storage-tree v2 (256-bit routing) activation is node-configured and not published over RPC, so this explorer cannot tell which routing applies at this height. Account proofs verify the same way under either layout.";
  }
}