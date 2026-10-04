import { describe, expect, it } from "vitest";
import {
  contractStorageWordToHex,
  isZeroContractStorageWord,
  metadataHashWordToFetchUrls,
} from "./reference-nft-storage";

describe("contractStorageWordToHex", () => {
  it("reads { value } from boing_getContractStorage", () => {
    expect(contractStorageWordToHex({ value: "0x" + "ab".repeat(32) })).toBe("0x" + "ab".repeat(32));
  });

  it("does not stringify objects as [object Object]", () => {
    const word = { value: "0x" + "00".repeat(32) };
    expect(String(word)).toBe("[object Object]");
    expect(contractStorageWordToHex(word)).toBe("0x" + "00".repeat(32));
    expect(isZeroContractStorageWord(word)).toBe(true);
  });

  it("accepts bare hex strings", () => {
    expect(contractStorageWordToHex("ff".repeat(32))).toBe("0x" + "ff".repeat(32));
  });
});

describe("metadataHashWordToFetchUrls", () => {
  it("returns empty for zero words", () => {
    expect(metadataHashWordToFetchUrls("0x" + "00".repeat(32))).toEqual([]);
  });

  it("includes ipfs gateway candidate for non-zero hashes", () => {
    const urls = metadataHashWordToFetchUrls("0x" + "ab".repeat(32));
    expect(urls.some((u) => u.includes("ipfs.io/ipfs/"))).toBe(true);
  });
});
