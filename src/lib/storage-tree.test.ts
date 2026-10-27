import { describe, expect, it } from "vitest";
import {
  describeActivationStatus,
  describeStorageTree,
  parseActivationHeight,
  readActivationFromNodeInfo,
  resolveStorageActivation,
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
  it("is legacy at every height when the node reports v2 is off", () => {
    expect(storageTreeModeAt(5_000_000, "off")).toBe("legacy-64bit");
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
  it("reads an explicit null as off (not scheduled) and distinguishes it from an absent key", () => {
    expect(readActivationFromNodeInfo({ storage_tree_v2_activation_height: null })).toBe("off");
    expect(readActivationFromNodeInfo({ head_height: 1 })).toBeNull();
    expect(readActivationFromNodeInfo({ storage_tree_v2_activation_height: "junk" })).toBeNull();
  });
  it("resolve: node info wins, absent falls back to unknown (no build mirror in tests)", () => {
    expect(resolveStorageActivation({ storage_tree_v2_activation_height: 9 })).toBe(9);
    expect(resolveStorageActivation({ storage_tree_v2_activation_height: null })).toBe("off");
    expect(resolveStorageActivation(undefined)).toBeNull();
  });
});

describe("describeStorageTree", () => {
  it("describes each mode", () => {
    expect(describeStorageTree(10, 5)).toMatch(/256 bits/);
    expect(describeStorageTree(1, 5)).toMatch(/64 bits/);
    expect(describeStorageTree(1, null)).toMatch(/does not report a storage-tree v2 activation height/);
    expect(describeStorageTree(1, "off")).toMatch(/not scheduled/);
  });
});

describe("describeActivationStatus", () => {
  it("is pending with the blocks to go before H (live testnet: head 1321, H 4400)", () => {
    const s = describeActivationStatus(1321, 4400);
    expect(s.state).toBe("pending");
    expect(s.blocksRemaining).toBe(3079);
    expect(s.summary).toBe("Storage-tree v2: not yet active. Activates at height 4,400 (3,079 blocks to go).");
  });
  it("uses the singular for the last block and is active from H itself", () => {
    expect(describeActivationStatus(4399, 4400).summary).toContain("(1 block to go)");
    const at = describeActivationStatus(4400, 4400);
    expect(at.state).toBe("active");
    expect(at.blocksRemaining).toBeNull();
    expect(describeActivationStatus(9000, 4400).summary).toBe("Storage-tree v2: active since height 4,400.");
  });
  it("does not invent a remaining count without a usable head", () => {
    for (const head of [null, -1, 1.5, NaN]) {
      const s = describeActivationStatus(head, 4400);
      expect(s.state).toBe("pending");
      expect(s.blocksRemaining).toBeNull();
    }
  });
  it("reports off / unknown without guessing", () => {
    expect(describeActivationStatus(5, "off").state).toBe("off");
    expect(describeActivationStatus(5, null).state).toBe("unknown");
  });
});
