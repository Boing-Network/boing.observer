import { describe, expect, it } from "vitest";
import { isAccountHex, normalizeVoterHex } from "./qa-reviewer-auth";

describe("qa-reviewer-auth", () => {
  it("normalizes voter hex", () => {
    const hex = "ab".repeat(32);
    expect(normalizeVoterHex(`0x${hex.toUpperCase()}`)).toBe(hex);
    expect(isAccountHex(hex)).toBe(true);
    expect(isAccountHex("short")).toBe(false);
    expect(isAccountHex("gg".repeat(32))).toBe(false);
  });
});
