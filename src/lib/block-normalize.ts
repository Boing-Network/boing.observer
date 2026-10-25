/**
 * Tolerant block decoding for the explorer, mirroring the node's `from_bincode` / JSON semantics for the
 * optional fee-market fields:
 * - `Block.priority_tips` is omitted entirely when nobody tipped (and may be absent on older nodes/blocks).
 * - When present it should have one entry per transaction, but a short, null or malformed list must not break
 *   the page: missing / invalid entries count as a zero tip.
 * - A transaction without a trailing `priority_tip` (the signed-tx encoding omits it when zero) is a zero tip.
 */
import { parseTipU128 } from "./priority-tips";

type BlockLike = {
  transactions?: unknown;
  priority_tips?: unknown;
};

/** Normalize `priority_tips` to `undefined` (no tips) or a string[] aligned with `transactions`. */
export function normalizePriorityTips(tips: unknown, txCount: number): string[] | undefined {
  if (!Array.isArray(tips) || tips.length === 0) return undefined;
  const out: string[] = [];
  let any = false;
  for (let i = 0; i < txCount; i += 1) {
    const tip = i < tips.length ? parseTipU128(tips[i]) : null;
    if (tip != null && tip > BigInt(0)) {
      any = true;
      out.push(tip.toString());
    } else {
      out.push("0");
    }
  }
  return any ? out : undefined;
}

/**
 * Returns the block with a well-formed `transactions` array and an aligned (or absent) `priority_tips`.
 * Returns the input object unchanged when it already conforms, so cached blocks are not cloned needlessly.
 */
export function normalizeBlock<T extends BlockLike>(block: T | null | undefined): T | null {
  if (block == null || typeof block !== "object") return null;
  const txs = Array.isArray(block.transactions) ? block.transactions : null;
  const txCount = txs ? txs.length : 0;
  const tips = normalizePriorityTips(block.priority_tips, txCount);

  const sameTips =
    tips === undefined
      ? block.priority_tips === undefined
      : Array.isArray(block.priority_tips) &&
        block.priority_tips.length === tips.length &&
        block.priority_tips.every((v, i) => v === tips[i]);

  if (txs && sameTips) return block;

  const next: Record<string, unknown> = { ...block, transactions: txs ?? [] };
  if (tips === undefined) delete next.priority_tips;
  else next.priority_tips = tips;
  return next as T;
}

/** Tip of one transaction: the block's aligned `priority_tips` entry, else the tx's own optional `priority_tip`. */
export function txPriorityTip(
  block: { priority_tips?: ReadonlyArray<string | number> | null } | null | undefined,
  index: number,
  tx?: { priority_tip?: unknown } | null,
): bigint | null {
  const tips = block?.priority_tips;
  if (Array.isArray(tips) && Number.isInteger(index) && index >= 0 && index < tips.length) {
    const tip = parseTipU128(tips[index]);
    if (tip != null && tip > BigInt(0)) return tip;
  }
  const own = parseTipU128(tx?.priority_tip);
  return own != null && own > BigInt(0) ? own : null;
}