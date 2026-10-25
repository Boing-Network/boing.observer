/**
 * `boing_getTransactionReceipt` returns `null` both for unknown ids and for receipts the node has pruned.
 * Nodes keep the newest `BOING_RECEIPT_RETENTION_BLOCKS` blocks of receipts (default 1,000,000, pruned every
 * 256 blocks; `0` keeps everything). Blocks, headers and signed payloads are never pruned, so an old
 * transaction is still on chain even when its receipt lookup is empty. The node's real window is not published
 * over RPC; operators can mirror it with `NEXT_PUBLIC_BOING_RECEIPT_RETENTION_BLOCKS`.
 */

export const DEFAULT_RECEIPT_RETENTION_BLOCKS = 1_000_000;

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
  /** Receipts for blocks below this height may have been pruned (only for `maybe_pruned`). */
  oldestKeptHeight: number | null;
}

/** `0` = keep everything; otherwise a positive integer. Invalid or unset values fall back to the node default. */
export function parseRetentionBlocks(raw: unknown): number {
  if (typeof raw !== "string" || !/^\d{1,12}$/.test(raw.trim())) return DEFAULT_RECEIPT_RETENTION_BLOCKS;
  return Number(raw.trim());
}

export function configuredReceiptRetentionBlocks(): number {
  return parseRetentionBlocks(process.env.NEXT_PUBLIC_BOING_RECEIPT_RETENTION_BLOCKS);
}

export function analyzeMissingReceipt(
  headHeight: number | null | undefined,
  retentionBlocks: number = DEFAULT_RECEIPT_RETENTION_BLOCKS,
): MissingReceiptAnalysis {
  if (retentionBlocks === 0) return { kind: "not_found", retentionBlocks, oldestKeptHeight: null };
  if (headHeight == null || !Number.isFinite(headHeight)) {
    return { kind: "unknown", retentionBlocks, oldestKeptHeight: null };
  }
  const oldest = headHeight - retentionBlocks;
  if (oldest <= 0) return { kind: "not_found", retentionBlocks, oldestKeptHeight: null };
  return { kind: "maybe_pruned", retentionBlocks, oldestKeptHeight: oldest };
}

export function describeMissingReceipt(a: MissingReceiptAnalysis, network: string): string {
  const window = a.retentionBlocks.toLocaleString("en-US");
  switch (a.kind) {
    case "not_found":
      return `No transaction with this id is known on ${network}. It may still be pending, belong to another network, or be a block hash or asset id.`;
    case "maybe_pruned":
      return `If this transaction is older than about block #${a.oldestKeptHeight}, its receipt may have been pruned: nodes keep receipts for the newest ${window} blocks (the node default). The block and signed payload stay on chain, so open the block if you know its height, or use an indexer or archive node. Otherwise the id is unknown, pending, or on another network.`;
    default:
      return `The chain head could not be read, so this explorer cannot tell whether the id is unknown or its receipt was pruned (nodes keep receipts for the newest ${window} blocks by default). Try again shortly.`;
  }
}