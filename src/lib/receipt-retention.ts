/**
 * `boing_getTransactionReceipt` returns `null` both for unknown ids and for receipts the node has pruned.
 * Nodes keep the newest `BOING_RECEIPT_RETENTION_BLOCKS` blocks of receipts (default 1,000,000, pruned every
 * 256 blocks; `0` keeps everything). Blocks, headers and signed payloads are never pruned, so an old
 * transaction is still on chain even when its receipt lookup is empty.
 *
 * Newer nodes publish the window as `receipt_retention_blocks` in `boing_getNetworkInfo` / `boing_health` (integer, or
 * `null` = unbounded). Precedence:
 * node info > `NEXT_PUBLIC_BOING_RECEIPT_RETENTION_BLOCKS` (build mirror) > the node default.
 */
import { findNodeInfoField } from "./node-info-fields";

export const DEFAULT_RECEIPT_RETENTION_BLOCKS = 1_000_000;

export type RetentionSource = "node" | "build" | "default";

export interface ReceiptRetention {
  /** `0` = the node keeps every receipt. */
  blocks: number;
  source: RetentionSource;
}

export type MissingReceiptKind =
  /** Receipts are never pruned here, or the whole chain still fits in the window: the id is unknown or pending. */
  | "not_found"
  /** Part of the chain is older than the retention window: the tx may predate the oldest kept receipt. */
  | "maybe_pruned"
  /** Head height unavailable: cannot tell. */
  | "unknown";

export interface MissingReceiptAnalysis {
  kind: MissingReceiptKind;
  retentionBlocks: number;
  source: RetentionSource;
  /** Receipts for blocks below this height may have been pruned (only for `maybe_pruned`). */
  oldestKeptHeight: number | null;
}

/** A non-negative safe integer (`0` = keep all) or `null` for anything else. */
export function parseRetentionStrict(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== "string" || !/^\d{1,12}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Env value as a retention window; invalid or unset values fall back to the node default. */
export function parseRetentionBlocks(raw: unknown): number {
  return parseRetentionStrict(raw) ?? DEFAULT_RECEIPT_RETENTION_BLOCKS;
}

export function configuredReceiptRetentionBlocks(): number {
  return parseRetentionBlocks(process.env.NEXT_PUBLIC_BOING_RECEIPT_RETENTION_BLOCKS);
}

/**
 * `receipt_retention_blocks` from node info (top level or one object deep). An integer is the window; an explicit
 * JSON `null` means "unbounded" (the node env value 0) and maps to `0`; an absent key (older node) or a malformed
 * value is `null` = unknown. Semantics: boing.network docs/RPC-API-SPEC.md ("Protocol parameters").
 */
export function readRetentionFromNodeInfo(info: unknown): number | null {
  const f = findNodeInfoField(info, "receipt_retention_blocks");
  if (!f.found) return null;
  if (f.value === null) return 0;
  return parseRetentionStrict(f.value);
}

export function resolveReceiptRetention(info: unknown): ReceiptRetention {
  const fromNode = readRetentionFromNodeInfo(info);
  if (fromNode != null) return { blocks: fromNode, source: "node" };
  const fromBuild = parseRetentionStrict(process.env.NEXT_PUBLIC_BOING_RECEIPT_RETENTION_BLOCKS);
  if (fromBuild != null) return { blocks: fromBuild, source: "build" };
  return { blocks: DEFAULT_RECEIPT_RETENTION_BLOCKS, source: "default" };
}

export function analyzeMissingReceipt(
  headHeight: number | null | undefined,
  retention: number | ReceiptRetention = DEFAULT_RECEIPT_RETENTION_BLOCKS,
): MissingReceiptAnalysis {
  const r: ReceiptRetention =
    typeof retention === "number" ? { blocks: retention, source: "default" } : retention;
  const base = { retentionBlocks: r.blocks, source: r.source };
  if (r.blocks === 0) return { kind: "not_found", ...base, oldestKeptHeight: null };
  if (headHeight == null || !Number.isFinite(headHeight)) return { kind: "unknown", ...base, oldestKeptHeight: null };
  const oldest = headHeight - r.blocks;
  if (oldest <= 0) return { kind: "not_found", ...base, oldestKeptHeight: null };
  return { kind: "maybe_pruned", ...base, oldestKeptHeight: oldest };
}

export function describeMissingReceipt(a: MissingReceiptAnalysis, network: string): string {
  const window = a.retentionBlocks.toLocaleString("en-US");
  const who = a.source === "node" ? "this node reports keeping" : "nodes keep";
  const suffix = a.source === "node" ? "" : a.source === "build" ? " (as configured for this explorer)" : " (the node default)";
  switch (a.kind) {
    case "not_found":
      return a.retentionBlocks === 0 && a.source === "node"
        ? `No transaction with this id is known on ${network}. This node keeps every receipt, so the id is unknown, still pending, on another network, or a block hash or asset id.`
        : `No transaction with this id is known on ${network}. It may still be pending, belong to another network, or be a block hash or asset id.`;
    case "maybe_pruned":
      return `If this transaction is older than about block #${a.oldestKeptHeight}, its receipt may have been pruned: ${who} receipts for the newest ${window} blocks${suffix}. The block and signed payload stay on chain, so open the block if you know its height, or use an indexer or archive node. Otherwise the id is unknown, pending, or on another network.`;
    default:
      return `The chain head could not be read, so this explorer cannot tell whether the id is unknown or its receipt was pruned (${who} receipts for the newest ${window} blocks${suffix}). Try again shortly.`;
  }
}