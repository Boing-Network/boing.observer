import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchTokenMetadata,
  fetchVaultMeta,
  mergeTokenMeta,
  resetTxContextRpcCaches,
  tokenMetaFromRpc,
  type RpcCaller,
} from "./tx-context-rpc";

const A = "aa".repeat(32);
const B = "bb".repeat(32);
const C = "cc".repeat(32);
const POOL = "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61";

beforeEach(() => resetTxContextRpcCaches());

describe("tokenMetaFromRpc / mergeTokenMeta", () => {
  it("maps the node's result; null fields stay null (no invented names)", () => {
    expect(tokenMetaFromRpc({ id: A, name: "Test Coin", symbol: "TST", decimals: 0, decimalsSource: "template" })).toEqual({
      symbol: "TST",
      name: "Test Coin",
      decimals: 0,
    });
    expect(tokenMetaFromRpc({ id: A, name: null, symbol: null, decimals: 0 })).toEqual({ symbol: null, name: null, decimals: 0 });
    expect(tokenMetaFromRpc({ id: A, name: null, symbol: null, decimals: null })).toBeNull();
    expect(tokenMetaFromRpc(null)).toBeNull();
    expect(tokenMetaFromRpc({ decimals: 300, name: " " })).toBeNull();
  });

  it("the node's answer wins, the DEX directory fills gaps", () => {
    expect(mergeTokenMeta({ symbol: "OLD", name: null, decimals: 6 }, { symbol: "NEW", name: "New", decimals: null })).toEqual({
      symbol: "NEW",
      name: "New",
      decimals: 6,
    });
    expect(mergeTokenMeta(undefined, null)).toBeUndefined();
    expect(mergeTokenMeta({ symbol: "X", name: null, decimals: null }, null)).toEqual({ symbol: "X", name: null, decimals: null });
  });
});

describe("fetchTokenMetadata", () => {
  it("looks every id up, including tokens that are in no DEX pool", async () => {
    const call = vi.fn<RpcCaller>(async (_m, params) => {
      const id = (params[0] as { id: string }).id;
      return id === `0x${A}` ? { id, name: "Orphan", symbol: "ORP", decimals: 0 } : null;
    });
    const out = await fetchTokenMetadata("testnet", [A, B], call);
    expect(out).toEqual({ [A]: { symbol: "ORP", name: "Orphan", decimals: 0 } });
    expect(call).toHaveBeenCalledWith("boing_getTokenMetadata", [{ id: `0x${A}` }]);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("caches answers, including 'not a token'", async () => {
    const call = vi.fn<RpcCaller>(async () => null);
    await fetchTokenMetadata("testnet", [A], call);
    await fetchTokenMetadata("testnet", [A], call);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("falls back (returns nothing) on a node without the method, and stops asking for a while", async () => {
    const err = Object.assign(new Error("Method not found"), { code: -32601 });
    const call = vi.fn<RpcCaller>(async () => {
      throw err;
    });
    let t = 1_000_000;
    expect(await fetchTokenMetadata("testnet", [A, B, C], call, () => t)).toEqual({});
    expect(call).toHaveBeenCalledTimes(1); // one probe, not one per id
    t += 60_000;
    expect(await fetchTokenMetadata("testnet", [B], call, () => t)).toEqual({});
    expect(call).toHaveBeenCalledTimes(1); // still backed off
    t += 11 * 60_000;
    await fetchTokenMetadata("testnet", [B], call, () => t);
    expect(call).toHaveBeenCalledTimes(2); // retried after the back-off (a node may have been upgraded)
  });

  it("a gateway that blocks the method (HTTP 403) counts as unsupported; a timeout is retried soon", async () => {
    const blocked = vi.fn<RpcCaller>(async () => {
      throw Object.assign(new Error("RPC HTTP 403"), { httpStatus: 403, code: null });
    });
    let t = 5_000_000;
    await fetchTokenMetadata("testnet", [A], blocked, () => t);
    t += 5 * 60_000;
    await fetchTokenMetadata("testnet", [B], blocked, () => t);
    expect(blocked).toHaveBeenCalledTimes(1);

    resetTxContextRpcCaches();
    const flaky = vi.fn<RpcCaller>(async () => {
      throw new Error("timed out");
    });
    await fetchTokenMetadata("testnet", [A], flaky, () => t);
    t += 31_000;
    await fetchTokenMetadata("testnet", [B], flaky, () => t);
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it("one failing id does not lose the others", async () => {
    const call = vi.fn<RpcCaller>(async (_m, params) => {
      const id = (params[0] as { id: string }).id;
      if (id === `0x${B}`) throw new Error("boom");
      return { id, name: null, symbol: id === `0x${A}` ? "AAA" : "CCC", decimals: 0 };
    });
    const out = await fetchTokenMetadata("testnet", [A, B, C], call);
    expect(Object.keys(out).sort()).toEqual([A, C].sort());
  });

  it("ignores malformed ids", async () => {
    const call = vi.fn<RpcCaller>(async () => null);
    await fetchTokenMetadata("testnet", ["nothex", "0xabc"], call);
    expect(call).not.toHaveBeenCalled();
  });
});

describe("fetchVaultMeta", () => {
  const word = (id: string) => ({ value: `0x${id}` });
  it("reads pool and token pair from storage slots 0xe2..0xe4", async () => {
    const slots: Record<string, string> = {
      [`0x${"0".repeat(62)}e2`]: POOL,
      [`0x${"0".repeat(62)}e3`]: A,
      [`0x${"0".repeat(62)}e4`]: B,
    };
    const call = vi.fn<RpcCaller>(async (method, params) => {
      expect(method).toBe("boing_getContractStorage");
      return word(slots[params[1] as string] ?? "0".repeat(64));
    });
    expect(await fetchVaultMeta("testnet", C, call)).toEqual({ pool: POOL, tokenA: A, tokenB: B });
    await fetchVaultMeta("testnet", C, call);
    expect(call).toHaveBeenCalledTimes(3); // cached
  });

  it("returns null for a vault that is not configured", async () => {
    const call = vi.fn<RpcCaller>(async () => word("0".repeat(64)));
    expect(await fetchVaultMeta("testnet", C, call)).toBeNull();
  });
});
