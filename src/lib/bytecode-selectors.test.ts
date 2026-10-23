import { describe, expect, it } from "vitest";
import {
  BOING_CUSTODY_ROUTER_BYTECODE_HEX,
  DEFAULT_BUILDER_ATTESTATION_REGISTRY_BYTECODE_HEX,
  DEFAULT_LINKED_NFT_TOKEN_REGISTRY_BYTECODE_HEX,
  DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_BYTECODE_HEX,
  DEFAULT_REFERENCE_NFT_COLLECTION_TEMPLATE_BYTECODE_HEX,
  boingPoolBytecodeHex,
  boingTokenBytecodeHex,
} from "@boing-network/boing-sdk";
import { decodeDispatchSelectors, hexToBytesLoose } from "./bytecode-selectors";
import { CONTRACT_INTERFACES, interfaceSelectors, matchInterfaceBySelectors } from "./contract-interfaces";
import { encodeContractCall, returnWords, wordAsUint } from "./contract-call-encode";

const dec = (hex: string) => decodeDispatchSelectors(hexToBytesLoose(hex));

describe("decodeDispatchSelectors (canonical templates)", () => {
  it("fungible v1 / v2", () => {
    expect(dec(boingTokenBytecodeHex(1))).toEqual([0x01, 0x02]);
    expect(dec(DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_BYTECODE_HEX)).toEqual([0x01, 0x02]);
    expect(dec(boingTokenBytecodeHex(2))).toEqual(interfaceSelectors("fungible-v2"));
  });
  it("NFT collection", () => {
    expect(dec(DEFAULT_REFERENCE_NFT_COLLECTION_TEMPLATE_BYTECODE_HEX)).toEqual(interfaceSelectors("nft"));
  });
  it("pools gain selectors by version", () => {
    expect(dec(boingPoolBytecodeHex(1))).toEqual([0x10, 0x11, 0x12]);
    expect(dec(boingPoolBytecodeHex(2))).toEqual([0x10, 0x11, 0x12, 0x13]);
    expect(dec(boingPoolBytecodeHex(5))).toEqual([0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16]);
    expect(dec(boingPoolBytecodeHex(9))).toEqual(interfaceSelectors("pool-custody"));
  });
  it("custody router ignores hop-count and return-word comparisons", () => {
    expect(dec(BOING_CUSTODY_ROUTER_BYTECODE_HEX)).toEqual([0xf1]);
  });
  it("registries", () => {
    expect(dec(DEFAULT_LINKED_NFT_TOKEN_REGISTRY_BYTECODE_HEX)).toEqual(interfaceSelectors("linked-nft-registry"));
    expect(dec(DEFAULT_BUILDER_ATTESTATION_REGISTRY_BYTECODE_HEX)).toEqual(interfaceSelectors("builder-attestation"));
  });
  it("hand-written dispatch: PUSH1 0 MLOAD PUSH1 sel EQ PUSH1 dest JUMPI", () => {
    // 6000 51 6042 14 6010 57 00  -> selector 0x42
    expect(decodeDispatchSelectors(hexToBytesLoose("600051604214601057" + "00"))).toEqual([0x42]);
    expect(decodeDispatchSelectors(hexToBytesLoose("6001600214601057"))).toEqual([]);
  });
});

describe("matchInterfaceBySelectors", () => {
  it("prefers the exact set", () => {
    expect(matchInterfaceBySelectors([0x01, 0x02])).toEqual({ id: "fungible-v1", exact: true });
    expect(matchInterfaceBySelectors([0x01, 0x02, 0x08, 0x09, 0x0a])).toEqual({ id: "fungible-v2", exact: true });
    expect(matchInterfaceBySelectors([0xc0, 0xc1, 0xc2, 0xc3])).toEqual({ id: "lp-vault-v2", exact: true });
    expect(matchInterfaceBySelectors([0x01, 0x06, 0x07])).toEqual({ id: "lp-share-token", exact: true });
  });
  it("closest match for partial pools; nothing for unrelated selectors", () => {
    expect(matchInterfaceBySelectors([0x10, 0x11, 0x12])?.exact).toBe(false);
    expect(matchInterfaceBySelectors([0x99, 0x9a])).toBeNull();
    expect(matchInterfaceBySelectors([])).toBeNull();
  });
  it("every interface has unique selectors", () => {
    for (const i of Object.values(CONTRACT_INTERFACES)) {
      expect(new Set(i.functions.map((f) => f.selector)).size).toBe(i.functions.length);
    }
  });
});

describe("encodeContractCall", () => {
  it("allowance(owner, spender)", () => {
    const a = "ab".repeat(32);
    const b = "cd".repeat(32);
    const fn = CONTRACT_INTERFACES["fungible-v2"]!.functions.find((f) => f.name === "allowance")!;
    expect(encodeContractCall(fn.selector, fn.params, [`0x${a}`, b])).toBe(`0x${"0".repeat(62)}0a${a}${b}`);
  });
  it("u64 / u128 words are big-endian and range-checked", () => {
    expect(encodeContractCall(0xd2, [{ name: "index", type: "u64" }], ["258"])).toBe(`0x${"0".repeat(62)}d2${"0".repeat(60)}0102`);
    expect(() => encodeContractCall(0xd2, [{ name: "index", type: "u64" }], ["-1"])).toThrow();
    expect(() => encodeContractCall(0x0a, [{ name: "owner", type: "account" }], ["0x12"])).toThrow(/64 characters/);
  });
  it("return words", () => {
    const w = returnWords(`0x${"0".repeat(62)}2a${"ff".repeat(32)}`);
    expect(w).toHaveLength(2);
    expect(wordAsUint(w[0]!)).toBe("42");
    expect(wordAsUint(w[1]!)).toBeNull();
  });
});