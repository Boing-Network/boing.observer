import { describe, expect, it } from "vitest";
import { parseNetworkParam, resolveInitialNetwork, syncNetworkInSearch } from "./network-param";

describe("parseNetworkParam", () => {
  it("accepts testnet and mainnet case-insensitively", () => {
    expect(parseNetworkParam("testnet")).toBe("testnet");
    expect(parseNetworkParam(" MainNet ")).toBe("mainnet");
  });
  it("ignores everything else", () => {
    for (const v of [null, undefined, "", "devnet", "1", "mainnet,testnet"]) expect(parseNetworkParam(v)).toBeNull();
  });
});

describe("resolveInitialNetwork", () => {
  const base = { stored: null, mainnetConfigured: true };
  it("deep link beats the stored preference", () => {
    expect(resolveInitialNetwork({ ...base, search: "?network=testnet", stored: "mainnet" })).toEqual({
      network: "testnet",
      source: "url",
      unavailable: null,
    });
    expect(resolveInitialNetwork({ ...base, search: "?network=mainnet", stored: "testnet" }).network).toBe("mainnet");
  });
  it("falls back to testnet and flags it when mainnet is not configured", () => {
    expect(resolveInitialNetwork({ search: "?network=mainnet", stored: null, mainnetConfigured: false })).toEqual({
      network: "testnet",
      source: "url",
      unavailable: "mainnet",
    });
  });
  it("uses the stored preference when the URL has none, and drops a stored mainnet when unconfigured", () => {
    expect(resolveInitialNetwork({ ...base, search: "", stored: "mainnet" })).toMatchObject({ network: "mainnet", source: "stored" });
    expect(resolveInitialNetwork({ search: "", stored: "mainnet", mainnetConfigured: false })).toMatchObject({
      network: "testnet",
      unavailable: null,
    });
  });
  it("defaults to testnet and ignores an invalid param", () => {
    expect(resolveInitialNetwork({ ...base, search: "?network=bogus" })).toEqual({ network: "testnet", source: "default", unavailable: null });
    expect(resolveInitialNetwork({ ...base, search: "?x=1" }).source).toBe("default");
  });
});

describe("syncNetworkInSearch", () => {
  it("rewrites only an existing network param and preserves others", () => {
    expect(syncNetworkInSearch("?network=mainnet&a=1", "testnet")).toBe("?network=testnet&a=1");
  });
  it("returns null when absent or already correct", () => {
    expect(syncNetworkInSearch("", "testnet")).toBeNull();
    expect(syncNetworkInSearch("?a=1", "mainnet")).toBeNull();
    expect(syncNetworkInSearch("?network=testnet", "testnet")).toBeNull();
  });
});