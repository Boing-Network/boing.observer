import type { TransactionReceipt } from "./rpc-types";

/** A tx whose receipt says it reverted. Missing receipt = unknown, not failed. */
export function isFailedReceipt(receipt: TransactionReceipt | null | undefined): boolean {
  return receipt?.success === false;
}

/** Fee a failed tx still paid, in whole BOING (base cost is 1 BOING per 21,000 gas, rounded up). */
export function failedTxFeeBoing(receipt: TransactionReceipt | null | undefined): number | null {
  if (!receipt || receipt.success !== false || !receipt.gas_used) return null;
  return Math.max(1, Math.ceil(Number(receipt.gas_used) / 21000));
}
