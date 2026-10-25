import { describe, expect, it } from "vitest";
import { normalizeBlock, normalizePriorityTips, txPriorityTip } from "./block-normalize";
import { priorityTipAt, summarizePriorityTips } from "./priority-tips";

const tx = (n: number) => Array.from({ length: n }, () => ({ sender: "aa", nonce: 0 }));

describe("normalizePriorityTips (from_bincode semantics)", () => {
  it("absent / null / empty -> undefined (no tips)", () => {
    expect(normalizePriorityTips(undefined, 3)).toBeUndefined();
    expect(normalizePriorityTips(null, 3)).toBeUndefined();
    expect(normalizePriorityTips([], 3)).toBeUndefined();
    expect(normalizePriorityTips("nope", 3)).toBeUndefined();
  });

  it("all-zero tips collapse to undefined", () => {
    expect(normalizePriorityTips([0, "0", 0], 3)).toBeUndefined();
  });

  it("short list is padded with zero tips", () => {
    expect(normalizePriorityTips([5], 3)).toEqual(["5", "0", "0"]);
  });

  it("long list is truncated to the tx count", () => {
    expect(normalizePriorityTips([1, 2, 3], 2)).toEqual(["1", "2"]);
  });

  it("malformed entries are zero; u128 strings above 2^53 survive", () => {
    const big = "340282366920938463463374607431768211455";
    expect(normalizePriorityTips([null, -1, 1.5, "x", big], 5)).toEqual(["0", "0", "0", "0", big]);
  });
});

describe("normalizeBlock", () => {
  it("returns the same object when already conformant (no clone for cached blocks)", () => {
    const b = { transactions: tx(2), priority_tips: ["0", "7"] };
    expect(normalizeBlock(b)).toBe(b);
    const noTips = { transactions: tx(2) };
    expect(normalizeBlock(noTips)).toBe(noTips);
  });

  it("tolerates an absent priority_tips and missing transactions", () => {
    const out = normalizeBlock({} as { transactions?: unknown; priority_tips?: unknown });
    expect(out?.transactions).toEqual([]);
    expect(out && "priority_tips" in out).toBe(false);
  });

  it("drops an all-zero or malformed priority_tips key and aligns a short one", () => {
    expect(normalizeBlock({ transactions: tx(2), priority_tips: [0, 0] })).not.toHaveProperty("priority_tips");
    expect(normalizeBlock({ transactions: tx(3), priority_tips: [9] })?.priority_tips).toEqual(["9", "0", "0"]);
  });

  it("null in -> null out", () => {
    expect(normalizeBlock(null)).toBeNull();
    expect(normalizeBlock(undefined)).toBeNull();
  });
});

describe("tip lookup with a missing trailing priority_tip", () => {
  const block = normalizeBlock({ transactions: tx(3), priority_tips: [0, 12, 0] });

  it("reads the aligned block entry", () => {
    expect(txPriorityTip(block, 1)).toBe(BigInt(12));
    expect(priorityTipAt(block, 1)).toBe(BigInt(12));
    expect(summarizePriorityTips(block)).toEqual({ total: BigInt(12), count: 1 });
  });

  it("is null (zero tip) for tx without a tip or without the field", () => {
    expect(txPriorityTip(block, 0, { })).toBeNull();
    expect(txPriorityTip(block, 2, { priority_tip: undefined })).toBeNull();
    expect(txPriorityTip(normalizeBlock({ transactions: tx(1) }), 0, {})).toBeNull();
    expect(txPriorityTip(undefined, 0, undefined)).toBeNull();
  });

  it("falls back to the tx's own priority_tip (string or number)", () => {
    expect(txPriorityTip({ priority_tips: undefined }, 0, { priority_tip: "40" })).toBe(BigInt(40));
    expect(txPriorityTip(null, 0, { priority_tip: 3 })).toBe(BigInt(3));
    expect(txPriorityTip(null, 0, { priority_tip: "0" })).toBeNull();
  });
});