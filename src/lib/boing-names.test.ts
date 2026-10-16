import { describe, expect, it } from "vitest";
import { blocksToHuman, boingNameRentPerYear, looksLikeBoingName, nameHref, normalizeBoingName } from "./boing-names";

describe("boing names", () => {
  it("normalizes like the node", () => {
    expect(normalizeBoingName(" DexDeployer.boing ")).toEqual({ ok: true, label: "dexdeployer" });
    for (const bad of ["ab", "a--b", "-ab", "ab-", "0xabc", "12345", "a_b", "x".repeat(33)]) {
      expect(normalizeBoingName(bad).ok).toBe(false);
    }
  });
  it("search routing: names vs heights vs hex", () => {
    expect(looksLikeBoingName("alice.boing")).toBe(true);
    expect(looksLikeBoingName("alice")).toBe(true);
    expect(looksLikeBoingName("640")).toBe(false);
    expect(looksLikeBoingName("ab".repeat(32))).toBe(false);
    expect(looksLikeBoingName("0x" + "ab".repeat(32))).toBe(false);
  });
  it("rent tiers and helpers", () => {
    expect(["abc", "abcd", "abcde", "abcdef"].map(boingNameRentPerYear)).toEqual([10, 5, 2, 1]);
    expect(nameHref("alice", "testnet")).toBe("/name/alice?network=testnet");
    expect(blocksToHuman(15_768_000, 15_768_000)).toBe("~1.0 years");
    expect(blocksToHuman(21_600, 15_768_000)).toBe("< 1 day");
    expect(blocksToHuman(86_400, 15_768_000)).toBe("~2 days");
  });
});