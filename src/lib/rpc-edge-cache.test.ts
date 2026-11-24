import { describe, expect, it } from "vitest";
import {
  CODE_TTL_SEC,
  IMMUTABLE_TTL_SEC,
  TIP_TTL_SEC,
  cacheKeyUrl,
  cacheTtlSeconds,
  isCacheCandidate,
  readCachedResult,
  writeCachedResult,
} from "./rpc-edge-cache";

describe("cacheTtlSeconds", () => {
  it("caches finalized blocks and receipts for a day, newer ones not at all", () => {
    expect(cacheTtlSeconds("boing_getBlockByHeight", [100, true], { hash: "0x" }, 100)).toBe(IMMUTABLE_TTL_SEC);
    expect(cacheTtlSeconds("boing_getBlockByHeight", [101, true], { hash: "0x" }, 100)).toBe(0);
    expect(cacheTtlSeconds("boing_getBlockByHeight", [5], { hash: "0x" }, null)).toBe(0);
    expect(cacheTtlSeconds("boing_getTransactionReceipt", ["0xab"], { block_height: 50 }, 100)).toBe(IMMUTABLE_TTL_SEC);
    expect(cacheTtlSeconds("boing_getTransactionReceipt", ["0xab"], { block_height: 150 }, 100)).toBe(0);
    expect(cacheTtlSeconds("boing_getTransactionReceipt", ["0xab"], {}, 100)).toBe(0);
  });

  it("never caches null results or methods outside the list", () => {
    expect(cacheTtlSeconds("boing_getBlockByHash", ["0xab"], null, 100)).toBe(0);
    expect(cacheTtlSeconds("boing_getTransactionReceipt", ["0xab"], null, 100)).toBe(0);
    expect(cacheTtlSeconds("boing_getAccount", ["0xab"], { balance: "1" }, 100)).toBe(0);
    expect(isCacheCandidate("boing_getAccount")).toBe(false);
    expect(isCacheCandidate("boing_simulateContractCall")).toBe(false);
  });

  it("uses short TTLs for tip reads and code", () => {
    expect(cacheTtlSeconds("boing_chainHeight", [], 10, null)).toBe(TIP_TTL_SEC);
    expect(cacheTtlSeconds("boing_getBlockByHash", ["0xab"], { hash: "0xab" }, null)).toBe(IMMUTABLE_TTL_SEC);
    expect(cacheTtlSeconds("boing_getContractCode", ["0xab"], { bytecode: "0x00" }, null)).toBe(CODE_TTL_SEC);
  });
});

describe("edge cache read/write", () => {
  it("keys by network, method and params, and round-trips results", async () => {
    const store = new Map<string, { body: string; cc: string | null }>();
    const cache = {
      async match(req: Request) {
        const e = store.get(req.url);
        return e ? new Response(e.body) : undefined;
      },
      async put(req: Request, res: Response) {
        store.set(req.url, { body: await res.text(), cc: res.headers.get("Cache-Control") });
      },
    };
    expect(cacheKeyUrl("testnet", "boing_getBlockByHeight", [1])).not.toBe(cacheKeyUrl("mainnet", "boing_getBlockByHeight", [1]));
    expect(await readCachedResult("testnet", "boing_getBlockByHeight", [1], cache)).toBeUndefined();
    await writeCachedResult("testnet", "boing_getBlockByHeight", [1], { hash: "0x01" }, 60, cache);
    expect(await readCachedResult("testnet", "boing_getBlockByHeight", [1], cache)).toEqual({ hash: "0x01" });
    expect(await readCachedResult("testnet", "boing_getBlockByHeight", [1, true], cache)).toBeUndefined();
    expect([...store.values()][0]!.cc).toBe("public, max-age=60");
    await writeCachedResult("testnet", "boing_getBlockByHeight", [2], { hash: "0x02" }, 0, cache);
    expect(store.size).toBe(1);
  });

  it("passes through when no cache is available", async () => {
    expect(await readCachedResult("testnet", "boing_chainHeight", [], null)).toBeUndefined();
    await expect(writeCachedResult("testnet", "boing_chainHeight", [], 1, 2, null)).resolves.toBeUndefined();
  });
});
