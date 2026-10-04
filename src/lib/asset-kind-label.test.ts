import { describe, expect, it } from "vitest";
import { formatAssetKindLabel, formatPurposeLabel, isNftPurposeOrKind } from "./asset-kind-label";

describe("formatAssetKindLabel", () => {
  it("labels nft kinds as NFT collection", () => {
    expect(formatAssetKindLabel("nft")).toBe("NFT collection");
    expect(formatAssetKindLabel("NFT")).toBe("NFT collection");
  });

  it("labels fungible and other", () => {
    expect(formatAssetKindLabel("fungible")).toBe("Fungible token");
    expect(formatAssetKindLabel("token")).toBe("Fungible token");
    expect(formatAssetKindLabel("other")).toBe("Other");
  });
});

describe("formatPurposeLabel", () => {
  it("maps nft purpose to nft collection", () => {
    expect(formatPurposeLabel("NFT")).toBe("nft collection");
    expect(formatPurposeLabel("nft")).toBe("nft collection");
  });

  it("preserves other categories in lowercase", () => {
    expect(formatPurposeLabel("token")).toBe("token");
    expect(formatPurposeLabel("dApp")).toBe("dApp");
    expect(formatPurposeLabel("other")).toBe("other");
  });
});

describe("isNftPurposeOrKind", () => {
  it("detects nft signals", () => {
    expect(isNftPurposeOrKind("nft")).toBe(true);
    expect(isNftPurposeOrKind("NFT collection")).toBe(true);
    expect(isNftPurposeOrKind("token")).toBe(false);
  });
});
