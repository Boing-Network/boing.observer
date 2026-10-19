import { describe, expect, it } from "vitest";
import { parseMintFirstFromCalldata } from "./fungible-mint-supply";

describe("parseMintFirstFromCalldata", () => {
  it("decodes selector 0x02 + to + amount", () => {
    const to = "80".repeat(32);
    const amount = (1_000_000_000n).toString(16).padStart(64, "0");
    const head = "0".repeat(62) + "02";
    const hex = `0x${head}${to}${amount}`;
    expect(parseMintFirstFromCalldata(hex)).toEqual({
      to,
      amount: "1000000000",
    });
  });

  it("accepts byte-array calldata (RPC block shape)", () => {
    const toBytes = Array.from({ length: 32 }, () => 0x81);
    const amountBytes = Array(32).fill(0);
    amountBytes[31] = 42;
    const sel = Array(32).fill(0);
    sel[31] = 2;
    const decoded = parseMintFirstFromCalldata([...sel, ...toBytes, ...amountBytes]);
    expect(decoded?.amount).toBe("42");
    expect(decoded?.to).toBe("81".repeat(32));
  });

  it("rejects transfer selector", () => {
    const hex = `0x${"0".repeat(62)}01${"aa".repeat(32)}${"0".repeat(62)}01`;
    expect(parseMintFirstFromCalldata(hex)).toBeNull();
  });
});
