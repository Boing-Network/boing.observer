import { describe, expect, it } from "vitest";
import { failedTxFeeBaseUnits, isFailedReceipt } from "./failed-tx";
import type { TransactionReceipt } from "./rpc-types";

const r = (x: Partial<TransactionReceipt>) => x as TransactionReceipt;

describe("failed tx helpers", () => {
  it("only treats success:false as failed", () => {
    expect(isFailedReceipt(r({ success: false }))).toBe(true);
    expect(isFailedReceipt(r({ success: true }))).toBe(false);
    expect(isFailedReceipt(null)).toBe(false);
  });
  it("reports the fee of a 21000-gas failed transfer under the rule at its height", () => {
    const B = BigInt("1000000000000000000");
    expect(failedTxFeeBaseUnits(r({ success: false, gas_used: 21000 }), 900)).toBe(B);
    expect(failedTxFeeBaseUnits(r({ success: false, gas_used: 21000 }), 1050)).toBe(BigInt("21000000000000000"));
    expect(failedTxFeeBaseUnits(r({ success: true, gas_used: 21000 }), 900)).toBeNull();
  });
});
