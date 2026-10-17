import type { TransactionReceipt } from "./rpc-types";
import { feeBaseUnitsForGas } from "./native-unit";

/** A tx whose receipt says it reverted. Missing receipt = unknown, not failed. */
export function isFailedReceipt(receipt: TransactionReceipt | null | undefined): boolean {
  return receipt?.success === false;
}

/**
 * Fee a failed tx still paid, in base units: gas x 10^12 base units from the 18-decimals switch,
 * ceil(gas / 21,000) whole BOING before it (`height` = the tx's block; unknown = current rule).
 */
export function failedTxFeeBaseUnits(
  receipt: TransactionReceipt | null | undefined,
  height?: number | null,
  network?: string | null,
): bigint | null {
  if (!receipt || receipt.success !== false || !receipt.gas_used) return null;
  return feeBaseUnitsForGas(Math.max(0, Math.floor(Number(receipt.gas_used))), height, network);
}
