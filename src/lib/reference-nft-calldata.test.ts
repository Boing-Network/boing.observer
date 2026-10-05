import { describe, expect, it } from "vitest";
import { bytesToHex } from "boing-sdk";
import {
  REF_NFT_SELECTOR_MINT_BATCH,
  REF_NFT_SELECTOR_TRANSFER_NFT,
  decodeReferenceNftCalldata,
  tryReferenceNftTokenIdU64,
  tokenIdsFromDecodedReferenceNftCall,
} from "./reference-nft-calldata";
import { referenceNftTokenIdWordFromU64 } from "./reference-nft-storage";

function wordFromHex(hex32: string): Uint8Array {
  const h = hex32.replace(/^0x/i, "").padStart(64, "0");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function selectorWord(sel: number): Uint8Array {
  const out = new Uint8Array(32);
  out[31] = sel;
  return out;
}

function u64Word(n: number): Uint8Array {
  const out = new Uint8Array(32);
  let x = BigInt(n);
  for (let i = 31; i >= 24; i--) {
    out[i] = Number(x & BigInt(0xff));
    x >>= BigInt(8);
  }
  return out;
}

describe("tryReferenceNftTokenIdU64", () => {
  it("reads sequential low-u64 words", () => {
    expect(tryReferenceNftTokenIdU64(referenceNftTokenIdWordFromU64(1))).toBe(1);
    expect(tryReferenceNftTokenIdU64(referenceNftTokenIdWordFromU64(42))).toBe(42);
  });

  it("returns null for opaque hash ids", () => {
    const hash = "0x" + "ab".repeat(32);
    expect(tryReferenceNftTokenIdU64(hash)).toBeNull();
  });
});

describe("decodeReferenceNftCalldata", () => {
  it("decodes mint_batch", () => {
    const to = "0x" + "11".repeat(32);
    const id1 = referenceNftTokenIdWordFromU64(1);
    const id2 = "0x" + "cd".repeat(32);
    const h1 = "0x" + "22".repeat(32);
    const h2 = "0x" + "00".repeat(32);
    const out = new Uint8Array(96 + 64 * 2);
    out.set(selectorWord(REF_NFT_SELECTOR_MINT_BATCH), 0);
    out.set(wordFromHex(to), 32);
    out.set(u64Word(2), 64);
    out.set(wordFromHex(id1), 96);
    out.set(wordFromHex(id2), 128);
    out.set(wordFromHex(h1), 160);
    out.set(wordFromHex(h2), 192);

    const decoded = decodeReferenceNftCalldata(bytesToHex(out));
    expect(decoded?.selector).toBe(REF_NFT_SELECTOR_MINT_BATCH);
    if (decoded?.selector !== REF_NFT_SELECTOR_MINT_BATCH) throw new Error("expected mint_batch");
    expect(decoded.n).toBe(2);
    expect(decoded.to.toLowerCase()).toBe(to.toLowerCase());
    expect(decoded.tokenIds.map((t) => t.toLowerCase())).toEqual([id1.toLowerCase(), id2.toLowerCase()]);
    expect(tokenIdsFromDecodedReferenceNftCall(decoded)).toHaveLength(2);
  });

  it("decodes transfer_nft", () => {
    const to = "0x" + "33".repeat(32);
    const tokenId = "0x" + "ee".repeat(32);
    const out = new Uint8Array(96);
    out.set(selectorWord(REF_NFT_SELECTOR_TRANSFER_NFT), 0);
    out.set(wordFromHex(to), 32);
    out.set(wordFromHex(tokenId), 64);
    const decoded = decodeReferenceNftCalldata(bytesToHex(out));
    expect(decoded?.selector).toBe(REF_NFT_SELECTOR_TRANSFER_NFT);
    if (decoded?.selector !== REF_NFT_SELECTOR_TRANSFER_NFT) throw new Error("expected transfer");
    expect(decoded.tokenId.toLowerCase()).toBe(tokenId.toLowerCase());
  });

  it("rejects truncated mint_batch", () => {
    const out = new Uint8Array(96);
    out.set(selectorWord(REF_NFT_SELECTOR_MINT_BATCH), 0);
    out.set(u64Word(1), 64);
    expect(decodeReferenceNftCalldata(bytesToHex(out))).toBeNull();
  });
});
