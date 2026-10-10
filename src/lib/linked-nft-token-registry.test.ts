import { describe, expect, it } from "vitest";
import {
  decodeLinkedNftTokenGetLinkAtReturnData,
  decodeLinkedNftTokenLinksCountReturnData,
  encodeLinkedNftTokenGetLinkAtCalldataHex,
  encodeLinkedNftTokenLinksCountCalldataHex,
  resolveLinkedNftTokenRegistryId,
  SELECTOR_LINKED_NFT_TOKEN_GET_LINK_AT,
  SELECTOR_LINKED_NFT_TOKEN_LINKS_COUNT,
} from "./linked-nft-token-registry";
import { CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX } from "./testnet-constants";

describe("linked NFT↔token registry encode/decode", () => {
  it("encodes links_count selector 0xE3 in the last byte", () => {
    const hex = encodeLinkedNftTokenLinksCountCalldataHex();
    expect(hex).toHaveLength(66);
    expect(hex.slice(-2)).toBe(SELECTOR_LINKED_NFT_TOKEN_LINKS_COUNT.toString(16));
  });

  it("encodes get_link_at with index in the second word", () => {
    const hex = encodeLinkedNftTokenGetLinkAtCalldataHex(3);
    expect(hex).toHaveLength(130);
    // First word ends with selector 0xE4; second word ends with index 3.
    expect(hex.slice(64, 66)).toBe(SELECTOR_LINKED_NFT_TOKEN_GET_LINK_AT.toString(16));
    expect(hex.slice(-2)).toBe("03");
  });

  it("decodes links_count return data", () => {
    expect(decodeLinkedNftTokenLinksCountReturnData(`0x${"00".repeat(31)}02`)).toBe(2n);
    expect(decodeLinkedNftTokenLinksCountReturnData("0x")).toBe(0n);
  });

  it("decodes get_link_at and marks tombstones inactive", () => {
    const collection = "aa".repeat(32);
    const token = "bb".repeat(32);
    const active = decodeLinkedNftTokenGetLinkAtReturnData(`0x${collection}${token}`);
    expect(active.active).toBe(true);
    expect(active.collectionHex).toBe(`0x${collection}`);
    expect(active.tokenHex).toBe(`0x${token}`);

    const tomb = decodeLinkedNftTokenGetLinkAtReturnData(`0x${"00".repeat(64)}`);
    expect(tomb.active).toBe(false);
  });
});

describe("resolveLinkedNftTokenRegistryId", () => {
  it("prefers env override", () => {
    const env = `0x${"11".repeat(32)}`;
    const r = resolveLinkedNftTokenRegistryId({ network: "testnet", envRegistryHex: env });
    expect(r.source).toBe("env");
    expect(r.registryId).toBe(env);
  });

  it("reads network_info end_user when present", () => {
    const id = `0x${"22".repeat(32)}`;
    const r = resolveLinkedNftTokenRegistryId({
      network: "mainnet",
      envRegistryHex: "",
      endUser: { canonical_linked_nft_token_registry: id },
    });
    expect(r.source).toBe("network_info");
    expect(r.registryId).toBe(id);
  });

  it("falls back to testnet canonical registry", () => {
    const r = resolveLinkedNftTokenRegistryId({ network: "testnet", envRegistryHex: "" });
    expect(r.source).toBe("testnet_canonical");
    expect(r.registryId).toBe(CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX);
  });

  it("returns null on mainnet without env or network_info", () => {
    const r = resolveLinkedNftTokenRegistryId({ network: "mainnet", envRegistryHex: "" });
    expect(r.registryId).toBeNull();
    expect(r.source).toBeNull();
  });
});
