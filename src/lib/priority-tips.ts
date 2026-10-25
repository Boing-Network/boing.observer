/**
 * Optional priority tips (fee market v1). A block may carry `priority_tips`: one u128 per transaction,
 * same order as `transactions`, omitted entirely when nobody tipped. Entries are JSON numbers, or decimal
 * strings above 2^53-1 (see `u128_json` in boing-node `rpc_block_json.rs`). Amounts are ledger units
 * (base units from the denomination switch height; see `native-unit.ts`).
 */

import { formatBoingAt } from "./native-unit";

/** Parse one u128 tip from RPC JSON. Returns `null` for anything that is not a non-negative integer. */
export function parseTipU128(raw: unknown): bigint | null {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw >= 0 ? BigInt(raw) : null;
  }
  if (typeof raw === "string" && /^[0-9]{1,39}$/.test(raw)) {
    return BigInt(raw);
  }
  return null;
}

/** Tip paid by the transaction at `index`, or `null` when the block has none / it is zero. */
export function priorityTipAt(
  block: { priority_tips?: ReadonlyArray<string | number> | null } | null | undefined,
  index: number,
): bigint | null {
  const tips = block?.priority_tips;
  if (!Array.isArray(tips) || !Number.isInteger(index) || index < 0 || index >= tips.length) return null;
  const tip = parseTipU128(tips[index]);
  return tip != null && tip > BigInt(0) ? tip : null;
}

/** Sum and count of non-zero tips in a block (for the block summary). */
export function summarizePriorityTips(
  block: { priority_tips?: ReadonlyArray<string | number> | null } | null | undefined,
): { total: bigint; count: number } {
  let total = BigInt(0);
  let count = 0;
  for (const raw of block?.priority_tips ?? []) {
    const tip = parseTipU128(raw);
    if (tip != null && tip > BigInt(0)) {
      total += tip;
      count += 1;
    }
  }
  return { total, count };
}

/** Human BOING string for a tip at a given block height (handles the whole-BOING era). */
export function formatPriorityTip(
  tip: bigint,
  height: number | null | undefined,
  network: string | null | undefined,
): string {
  return formatBoingAt(tip.toString(), height, network);
}
