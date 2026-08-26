import { describe, expect, it } from "vitest";
import {
  isAccountHex,
  normalizeSignedTxHex,
  normalizeVoterHex,
  qaPoolVoteRpcParams,
} from "./qa-reviewer-auth";

describe("qa-reviewer-auth", () => {
  it("normalizes voter hex", () => {
    const hex = "ab".repeat(32);
    expect(normalizeVoterHex(`0x${hex.toUpperCase()}`)).toBe(hex);
    expect(isAccountHex(hex)).toBe(true);
    expect(isAccountHex("short")).toBe(false);
    expect(isAccountHex("gg".repeat(32))).toBe(false);
  });

  it("normalizes signed tx hex", () => {
    const signed = "ab".repeat(32);
    expect(normalizeSignedTxHex(`0x${signed.toUpperCase()}`)).toBe(signed);
    expect(normalizeSignedTxHex("short")).toBeNull();
    expect(normalizeSignedTxHex("gg".repeat(32))).toBeNull();
    expect(normalizeSignedTxHex("abc")).toBeNull();
  });

  it("builds unsigned and signed qaPoolVote RPC params", () => {
    const tx = "11".repeat(32);
    const voter = "22".repeat(32);
    expect(qaPoolVoteRpcParams(tx, voter, "allow")).toEqual([`0x${tx}`, `0x${voter}`, "allow"]);
    const signed = "cd".repeat(40);
    expect(qaPoolVoteRpcParams(tx, voter, "reject", signed)).toEqual([
      `0x${tx}`,
      `0x${voter}`,
      "reject",
      `0x${signed}`,
    ]);
  });
});
