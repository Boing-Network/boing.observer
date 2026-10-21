import type { TransactionReceipt } from "./rpc-types";
import { feeBaseUnitsForGas } from "./native-unit";

/** A tx whose receipt says it reverted. Missing receipt = unknown, not failed. */
export function isFailedReceipt(receipt: TransactionReceipt | null | undefined): boolean {
  return receipt?.success === false;
}

/**
 * Fee a failed tx still paid, in base units. Base-units era uses the recommended micro fee BPS
 * (`feeBaseUnitsForGas` default). Whole-BOING era: ceil(gas / 21,000) BOING.
 */
export function failedTxFeeBaseUnits(
  receipt: TransactionReceipt | null | undefined,
  height?: number | null,
  network?: string | null,
): bigint | null {
  if (!receipt || receipt.success !== false || !receipt.gas_used) return null;
  return feeBaseUnitsForGas(Math.max(0, Math.floor(Number(receipt.gas_used))), height, network);
}
