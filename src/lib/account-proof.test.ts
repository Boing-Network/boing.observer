import { describe, expect, it } from "vitest";
import { BoingRpcCallError } from "./rpc-error";
import { findRootMatch, hexByteLength, isMethodNotFound, parseAccountProofResult } from "./account-proof";

const R = "ab".repeat(32);

describe("findRootMatch", () => {
  it("finds the newest header with the same state root, ignoring 0x and case", () => {
    expect(
      findRootMatch(`0x${R.toUpperCase()}`, [
        { height: 10, state_root: "cd".repeat(32) },
        { height: 9, state_root: R },
      ]),
    ).toBe(9);
  });
  it("returns null when nothing matches or roots are missing", () => {
    expect(findRootMatch(R, [{ height: 1, state_root: "00".repeat(32) }, { height: 0 }])).toBeNull();
    expect(findRootMatch("", [{ height: 1, state_root: "" }])).toBeNull();
  });
});

describe("hexByteLength", () => {
  it("measures even-length hex only", () => {
    expect(hexByteLength("0xabcd")).toBe(2);
    expect(hexByteLength("abc")).toBeNull();
    expect(hexByteLength("zz")).toBeNull();
    expect(hexByteLength("")).toBeNull();
  });
});

describe("parseAccountProofResult", () => {
  it("accepts the documented shape", () => {
    expect(parseAccountProofResult({ proof: "0xabcd", root: R, value_hash: "ef" })).toEqual({
      proof: "0xabcd",
      root: R,
      value_hash: "ef",
    });
  });
  it("rejects malformed shapes", () => {
    expect(parseAccountProofResult(null)).toBeNull();
    expect(parseAccountProofResult({ proof: 1, root: R })).toBeNull();
    expect(parseAccountProofResult({ proof: "xyz", root: R })).toBeNull();
  });
});

describe("isMethodNotFound", () => {
  it("recognises -32601 and proxy rejections", () => {
    expect(isMethodNotFound(new BoingRpcCallError("Method not found", { code: -32601 }))).toBe(true);
    expect(isMethodNotFound(new BoingRpcCallError("boom", { code: -32602 }))).toBe(false);
    expect(isMethodNotFound(new Error("Method not found"))).toBe(false);
  });
});