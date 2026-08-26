import { describe, expect, it } from "vitest";
import {
  explorerAccountHref,
  explorerAssetHref,
  explorerBlockHashHref,
  explorerBlockHeightHref,
  explorerTxHref,
} from "./explorer-href";

const HEX = "a".repeat(64);

describe("explorer hrefs", () => {
  it("routes assets, accounts, and txs with the network query", () => {
    expect(explorerAssetHref(`0x${HEX}`, "testnet")).toBe(`/asset/${HEX}?network=testnet`);
    expect(explorerAccountHref(HEX, "testnet")).toBe(`/account/${HEX}?network=testnet`);
    expect(explorerTxHref(`0x${HEX}`, "mainnet")).toBe(`/tx/${HEX}?network=mainnet`);
    expect(explorerBlockHashHref(HEX, "testnet")).toBe(`/block/hash/${HEX}?network=testnet`);
  });

  it("anchors transaction slots on block-height URLs", () => {
    expect(explorerBlockHeightHref(12, "testnet")).toBe("/block/12?network=testnet");
    expect(explorerBlockHeightHref(12, "testnet", 3)).toBe("/block/12?network=testnet#tx-3");
  });

  it("returns home for invalid hex", () => {
    expect(explorerAssetHref("deadbeef", "testnet")).toBe("/");
    expect(explorerTxHref("", "testnet")).toBe("/");
  });
});
