import { describe, expect, it } from "vitest";
import { failedTxFeeBoing, isFailedReceipt } from "./failed-tx";
import type { TransactionReceipt } from "./rpc-types";

const r = (x: Partial<TransactionReceipt>) => x as TransactionReceipt;

describe("failed tx helpers", () => {
  it("only treats success:false as failed", () => {
    expect(isFailedReceipt(r({ success: false }))).toBe(true);
    expect(isFailedReceipt(r({ success: true }))).toBe(false);
    expect(isFailedReceipt(null)).toBe(false);
  });
  it("reports the 1 BOING fee of the 21000-gas failed transfer", () => {
    expect(failedTxFeeBoing(r({ success: false, gas_used: 21000 }))).toBe(1);
    expect(failedTxFeeBoing(r({ success: true, gas_used: 21000 }))).toBeNull();
  });
});
