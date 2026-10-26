import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECEIPT_RETENTION_BLOCKS,
  analyzeMissingReceipt,
  describeMissingReceipt,
  parseRetentionBlocks,
  readRetentionFromNodeInfo,
  resolveReceiptRetention,
} from "./receipt-retention";

describe("parseRetentionBlocks", () => {
  it("uses the node default unless a valid integer is set", () => {
    expect(parseRetentionBlocks(undefined)).toBe(DEFAULT_RECEIPT_RETENTION_BLOCKS);
    expect(parseRetentionBlocks("")).toBe(DEFAULT_RECEIPT_RETENTION_BLOCKS);
    expect(parseRetentionBlocks("abc")).toBe(DEFAULT_RECEIPT_RETENTION_BLOCKS);
    expect(parseRetentionBlocks("-5")).toBe(DEFAULT_RECEIPT_RETENTION_BLOCKS);
    expect(parseRetentionBlocks("250000")).toBe(250_000);
    expect(parseRetentionBlocks("0")).toBe(0);
  });
});

describe("node info", () => {
  it("reads receipt_retention_blocks at top level or one level down, including 0", () => {
    expect(readRetentionFromNodeInfo({ receipt_retention_blocks: 500 })).toBe(500);
    expect(readRetentionFromNodeInfo({ end_user: { receipt_retention_blocks: "250" } })).toBe(250);
    expect(readRetentionFromNodeInfo({ receipt_retention_blocks: 0 })).toBe(0);
  });
  it("reads an explicit null as unbounded (keep everything), per the node RPC spec", () => {
    expect(readRetentionFromNodeInfo({ receipt_retention_blocks: null })).toBe(0);
    expect(resolveReceiptRetention({ receipt_retention_blocks: null })).toEqual({ blocks: 0, source: "node" });
  });
  it("tolerates absence and junk", () => {
    expect(readRetentionFromNodeInfo({ head_height: 1 })).toBeNull();
    expect(readRetentionFromNodeInfo({ receipt_retention_blocks: -1 })).toBeNull();
    expect(readRetentionFromNodeInfo({ receipt_retention_blocks: "junk" })).toBeNull();
    expect(readRetentionFromNodeInfo(undefined)).toBeNull();
  });
  it("resolve: node info, else default (no build mirror in tests)", () => {
    expect(resolveReceiptRetention({ receipt_retention_blocks: 10 })).toEqual({ blocks: 10, source: "node" });
    expect(resolveReceiptRetention(null)).toEqual({ blocks: DEFAULT_RECEIPT_RETENTION_BLOCKS, source: "default" });
  });
  it("words the message by source", () => {
    const fromNode = describeMissingReceipt(analyzeMissingReceipt(2_000, { blocks: 500, source: "node" }), "testnet");
    expect(fromNode).toMatch(/this node reports keeping receipts for the newest 500 blocks/);
    expect(fromNode).toMatch(/#1500/);
    const keepAll = describeMissingReceipt(analyzeMissingReceipt(9_000_000, { blocks: 0, source: "node" }), "testnet");
    expect(keepAll).toMatch(/keeps every receipt/);
    expect(keepAll).not.toMatch(/pruned/);
  });
});

describe("analyzeMissingReceipt", () => {
  it("is not_found while the whole chain fits in the window", () => {
    expect(analyzeMissingReceipt(5_000).kind).toBe("not_found");
    expect(analyzeMissingReceipt(DEFAULT_RECEIPT_RETENTION_BLOCKS).kind).toBe("not_found");
  });
  it("flags a possible prune once the head passes the window", () => {
    const a = analyzeMissingReceipt(1_500_000);
    expect(a.kind).toBe("maybe_pruned");
    expect(a.oldestKeptHeight).toBe(500_000);
  });
  it("never reports pruning when retention is 0 (keep all)", () => {
    expect(analyzeMissingReceipt(9_000_000, 0).kind).toBe("not_found");
  });
  it("is unknown without a head height", () => {
    expect(analyzeMissingReceipt(null).kind).toBe("unknown");
    expect(analyzeMissingReceipt(undefined).kind).toBe("unknown");
  });
});

describe("describeMissingReceipt", () => {
  it("gives a distinct, actionable message per kind", () => {
    expect(describeMissingReceipt(analyzeMissingReceipt(10), "testnet")).toMatch(/No transaction with this id is known on testnet/);
    const pruned = describeMissingReceipt(analyzeMissingReceipt(2_000_000), "testnet");
    expect(pruned).toMatch(/pruned/);
    expect(pruned).toMatch(/#1000000/);
    expect(pruned).toMatch(/1,000,000/);
    expect(describeMissingReceipt(analyzeMissingReceipt(null), "mainnet")).toMatch(/could not be read/);
  });
});