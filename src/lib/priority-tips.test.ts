import { describe, expect, it } from "vitest";
import { formatPriorityTip, parseTipU128, priorityTipAt, summarizePriorityTips } from "./priority-tips";

describe("parseTipU128", () => {
  it("accepts safe integers and decimal strings (u128 above 2^53-1)", () => {
    expect(parseTipU128(0)).toBe(BigInt(0));
    expect(parseTipU128(12345)).toBe(BigInt(12345));
    expect(parseTipU128("340282366920938463463374607431768211455")).toBe(
      BigInt("340282366920938463463374607431768211455"),
    );
  });

  it("rejects negatives, fractions, unsafe numbers, hex and junk", () => {
    for (const bad of [-1, 1.5, Number.MAX_SAFE_INTEGER + 2, "0x10", "1e3", "-4", "", null, undefined, {}]) {
      expect(parseTipU128(bad)).toBeNull();
    }
  });
});

describe("priorityTipAt / summarizePriorityTips", () => {
  const block = { priority_tips: [0, "5000000000000000000", 250, "junk"] as Array<string | number> };

  it("returns the tip for a tipped slot and null for zero / missing / invalid", () => {
    expect(priorityTipAt(block, 0)).toBeNull();
    expect(priorityTipAt(block, 1)).toBe(BigInt("5000000000000000000"));
    expect(priorityTipAt(block, 2)).toBe(BigInt(250));
    expect(priorityTipAt(block, 3)).toBeNull();
    expect(priorityTipAt(block, 4)).toBeNull();
    expect(priorityTipAt(block, -1)).toBeNull();
  });

  it("is null when the block omits priority_tips (nobody tipped)", () => {
    expect(priorityTipAt({}, 0)).toBeNull();
    expect(priorityTipAt(null, 0)).toBeNull();
    expect(summarizePriorityTips({})).toEqual({ total: BigInt(0), count: 0 });
  });

  it("sums only positive tips", () => {
    expect(summarizePriorityTips(block)).toEqual({ total: BigInt("5000000000000000250"), count: 2 });
  });
});

describe("formatPriorityTip", () => {
  it("formats base units after the switch height and whole BOING before it (testnet)", () => {
    expect(formatPriorityTip(BigInt("1500000000000000000"), 1100, "testnet")).toBe("1.5");
    expect(formatPriorityTip(BigInt(3), 900, "testnet")).toBe("3");
  });
});
