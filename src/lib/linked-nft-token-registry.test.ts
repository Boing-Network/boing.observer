import { describe, expect, it } from "vitest";
import {
  decodeLinkedNftTokenGetLinkAtReturnData,
  decodeLinkedNftTokenLinksCountReturnData,
  encodeLinkedNftTokenGetLinkAtCalldataHex,
  encodeLinkedNftTokenLinksCountCalldataHex,
  resolveLinkedNftTokenRegistryId,
  listLinkedCompanionsForAsset,
  encodeLinkedNftTokenGetAssetClaimerCalldataHex,
  decodeLinkedNftTokenAssetClaimerReturnData,
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

describe("managed links (wallet view via get_asset_claimer 0xE5)", () => {
  const ME = "d6".repeat(32);
  const COL = "63".repeat(32);
  const TOK = "98".repeat(32);
  const OTHER_COL = "11".repeat(32);
  const OTHER_TOK = "22".repeat(32);
  const word = (n: number) => `${"00".repeat(31)}${n.toString(16).padStart(2, "0")}`;
  function fakeClient() {
    const links = [
      [COL, TOK],
      ["00".repeat(32), "00".repeat(32)],
      [OTHER_COL, OTHER_TOK],
    ];
    const claimers: Record<string, string> = { [COL]: ME, [TOK]: ME, [OTHER_COL]: "33".repeat(32) };
    return {
      async simulateContractCall(_reg: string, calldata: string) {
        const h = calldata.replace(/^0x/, "");
        const sel = parseInt(h.slice(62, 64), 16);
        if (sel === 0xe3) return { success: true, return_data: `0x${word(links.length)}` };
        if (sel === 0xe4) {
          const i = parseInt(h.slice(-16), 16);
          return { success: true, return_data: `0x${links[i]![0]}${links[i]![1]}` };
        }
        if (sel === 0xe5) return { success: true, return_data: `0x${claimers[h.slice(64)] ?? "00".repeat(32)}` };
        return { success: false };
      },
    } as unknown as Parameters<typeof listLinkedCompanionsForAsset>[0]["client"];
  }

  it("encodes get_asset_claimer and decodes claimers", () => {
    const hex = encodeLinkedNftTokenGetAssetClaimerCalldataHex(`0x${COL}`);
    expect(hex).toHaveLength(130);
    expect(hex.slice(64, 66)).toBe("e5");
    expect(decodeLinkedNftTokenAssetClaimerReturnData(`0x${"00".repeat(32)}`)).toBeNull();
    expect(decodeLinkedNftTokenAssetClaimerReturnData(`0x${ME}`)).toBe(`0x${ME}`);
  });

  it("a wallet sees the links it claimed; an asset still sees its peer", async () => {
    const reg = `0x${"eb".repeat(32)}`;
    const wallet = await listLinkedCompanionsForAsset({ client: fakeClient(), registryId: reg, assetId: `0x${ME}` });
    expect(wallet.companions).toEqual([]);
    expect(wallet.managedLinks).toEqual([{ index: 0, collectionId: `0x${COL}`, tokenId: `0x${TOK}`, claimer: `0x${ME}` }]);
    const asset = await listLinkedCompanionsForAsset({ client: fakeClient(), registryId: reg, assetId: `0x${COL}` });
    expect(asset.companions).toHaveLength(1);
    expect(asset.companions[0]!.peerId).toBe(`0x${TOK}`);
    expect(asset.managedLinks).toEqual([]);
  });
});