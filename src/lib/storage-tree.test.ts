import { describe, expect, it } from "vitest";
import {
  describeStorageTree,
  parseActivationHeight,
  readActivationFromNodeInfo,
  storageTreeModeAt,
} from "./storage-tree";

describe("parseActivationHeight", () => {
  it("accepts non-negative integers as numbers or strings", () => {
    expect(parseActivationHeight(0)).toBe(0);
    expect(parseActivationHeight(1200)).toBe(1200);
    expect(parseActivationHeight(" 1200 ")).toBe(1200);
  });
  it("treats everything else as 'not activated / unknown'", () => {
    for (const v of [undefined, null, "", "off", "-1", "1.5", 1.5, -3, NaN, {}, "12abc", "9".repeat(20)]) {
      expect(parseActivationHeight(v)).toBeNull();
    }
  });
});

describe("storageTreeModeAt", () => {
  it("is unknown without an activation height (never guesses)", () => {
    expect(storageTreeModeAt(5, null)).toBe("unknown");
  });
  it("switches exactly at the activation height", () => {
    expect(storageTreeModeAt(99, 100)).toBe("legacy-64bit");
    expect(storageTreeModeAt(100, 100)).toBe("v2-256bit");
    expect(storageTreeModeAt(101, 100)).toBe("v2-256bit");
    expect(storageTreeModeAt(0, 0)).toBe("v2-256bit");
  });
});

describe("readActivationFromNodeInfo", () => {
  it("returns null for today's node info (nothing published)", () => {
    expect(readActivationFromNodeInfo({ head_height: 5, end_user: {} })).toBeNull();
    expect(readActivationFromNodeInfo(null)).toBeNull();
    expect(readActivationFromNodeInfo([1, 2])).toBeNull();
  });
  it("finds a top-level or one-level-nested field if a node ever publishes it", () => {
    expect(readActivationFromNodeInfo({ storage_tree_v2_activation_height: 42 })).toBe(42);
    expect(readActivationFromNodeInfo({ state: { storage_tree_v2_activation_height: "77" } })).toBe(77);
    expect(readActivationFromNodeInfo({ state: { storage_tree_v2_activation_height: "off" } })).toBeNull();
  });
});

describe("describeStorageTree", () => {
  it("describes each mode", () => {
    expect(describeStorageTree(10, 5)).toMatch(/256 bits/);
    expect(describeStorageTree(1, 5)).toMatch(/64 bits/);
    expect(describeStorageTree(1, null)).toMatch(/not published over RPC/);
  });
});