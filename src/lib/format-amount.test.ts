import { describe, expect, it } from "vitest";
import { compactAmount, formatBoingCompact, formatTokenDecimals } from "./format-amount";

describe("compactAmount", () => {
  it("groups small values and keeps the exact value", () => {
    expect(compactAmount("0")).toEqual({ short: "0", full: "0" });
    expect(compactAmount("999999")).toEqual({ short: "999,999", full: "999,999" });
  });
  it("uses K/M/B/T suffixes up to 15 digits", () => {
    expect(compactAmount("1000000").short).toBe("1M");
    expect(compactAmount("1250000").short).toBe("1.2M");
    expect(compactAmount("20000000000").short).toBe("20B");
    expect(compactAmount("999900000000000").short).toBe("999.9T");
    expect(compactAmount("1250000").full).toBe("1,250,000");
  });
  it("uses scientific notation for huge values (the failed 1e30 transfer)", () => {
    const c = compactAmount("1000000000000000000000000000000");
    expect(c.short).toBe("1.0e30");
    expect(c.full).toBe("1,000,000,000,000,000,000,000,000,000,000");
    expect(compactAmount(BigInt("340282366920938463463374607431768211455")).short).toBe("3.4e38");
    expect(formatBoingCompact("1000000000000000000000000000000")).toBe("1.0e30 BOING");
  });
  it("passes through non-integers", () => {
    expect(compactAmount("—").short).toBe("—");
  });
});

describe("formatTokenDecimals", () => {
  it("labels whole-unit tokens and real decimals", () => {
    expect(formatTokenDecimals(0)).toBe("0 (whole units)");
    expect(formatTokenDecimals(6)).toBe("6");
  });
  it("never invents 18 for unknown decimals", () => {
    expect(formatTokenDecimals(null)).toBe("Unknown");
    expect(formatTokenDecimals(undefined)).toBe("Unknown");
    expect(formatTokenDecimals(Number.NaN)).toBe("Unknown");
    expect(formatTokenDecimals(null, { short: true })).toBe("?");
    expect(formatTokenDecimals(0, { short: true })).toBe("0");
  });
});
