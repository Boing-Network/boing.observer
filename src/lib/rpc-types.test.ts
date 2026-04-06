import { describe, expect, it } from "vitest";
import { isHex64, normalizeAddress, normalizeHex64, stripHexPrefix, toPrefixedHex64 } from "./rpc-types";

describe("normalizeHex64", () => {
  it("accepts 64 hex without 0x", () => {
    const h = "a".repeat(64);
    expect(normalizeHex64(h)).toBe(h.toLowerCase());
  });

  it("accepts 64 hex with 0x", () => {
    const h = "b".repeat(64);
    expect(normalizeHex64(`0x${h}`)).toBe(h.toLowerCase());
  });

  it("rejects short hex (no padding)", () => {
    expect(normalizeHex64("abc")).toBe("");
    expect(normalizeHex64("0x" + "c".repeat(63))).toBe("");
  });

  it("rejects non-hex", () => {
    expect(normalizeHex64("g".repeat(64))).toBe("");
  });
});

describe("normalizeAddress", () => {
  it("matches normalizeHex64 for valid ids", () => {
    const h = "f".repeat(64);
    expect(normalizeAddress(`0x${h}`)).toBe(normalizeHex64(h));
  });
});

describe("isHex64", () => {
  it("mirrors normalizeHex64 emptiness", () => {
    expect(isHex64("a".repeat(64))).toBe(true);
    expect(isHex64("a".repeat(63))).toBe(false);
  });
});

describe("toPrefixedHex64", () => {
  it("adds 0x for valid input", () => {
    const h = "e".repeat(64);
    expect(toPrefixedHex64(h)).toBe(`0x${h}`);
  });

  it("returns empty when invalid", () => {
    expect(toPrefixedHex64("bad")).toBe("");
  });
});

describe("stripHexPrefix", () => {
  it("strips 0x case-insensitively", () => {
    expect(stripHexPrefix("0xAB")).toBe("AB");
    expect(stripHexPrefix("0Xcd")).toBe("cd");
  });
});
