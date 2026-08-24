import { describe, expect, it } from "vitest";
import {
  isAccountHex,
  normalizeVoterHex,
  parseReviewerAllowlist,
  reviewerTokensMatch,
  reviewerVotingConfigured,
  voterOnAllowlist,
} from "./qa-reviewer-auth";

describe("qa-reviewer-auth", () => {
  it("requires an 8+ char reviewer secret", () => {
    expect(reviewerVotingConfigured(undefined)).toBe(false);
    expect(reviewerVotingConfigured("short")).toBe(false);
    expect(reviewerVotingConfigured("reviewer-secret")).toBe(true);
  });

  it("parses a comma-separated allowlist", () => {
    const a = "11".repeat(32);
    const b = "22".repeat(32);
    const set = parseReviewerAllowlist(`0x${a}, ${b.toUpperCase()}, not-hex`);
    expect(set.size).toBe(2);
    expect(set.has(a)).toBe(true);
    expect(set.has(b)).toBe(true);
  });

  it("matches reviewer tokens", () => {
    expect(reviewerTokensMatch("abc", "abc")).toBe(true);
    expect(reviewerTokensMatch("abc", "abd")).toBe(false);
    expect(reviewerTokensMatch("ab", "abc")).toBe(false);
  });

  it("normalizes voter hex and allowlist", () => {
    const hex = "ab".repeat(32);
    expect(normalizeVoterHex(`0x${hex.toUpperCase()}`)).toBe(hex);
    expect(isAccountHex(hex)).toBe(true);
    expect(voterOnAllowlist(hex, new Set())).toBe(true);
    expect(voterOnAllowlist(hex, new Set([hex]))).toBe(true);
    expect(voterOnAllowlist(hex, new Set(["cd".repeat(32)]))).toBe(false);
  });
});
