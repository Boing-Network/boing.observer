import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedRpc, clearRpcCache, RPC_CACHE_MAX_ENTRIES, rpcCacheSize } from "./rpc-cache";

describe("cachedRpc", () => {
  beforeEach(() => {
    clearRpcCache();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dedupes within the TTL and reloads after it", async () => {
    const loader = vi.fn(async () => 1);
    await cachedRpc("k", 1000, loader);
    await cachedRpc("k", 1000, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await cachedRpc("k", 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(7);
    await expect(cachedRpc("f", 1000, loader)).rejects.toThrow("boom");
    await expect(cachedRpc("f", 1000, loader)).resolves.toBe(7);
  });

  it("is bounded and evicts expired entries before live ones", async () => {
    for (let i = 0; i < RPC_CACHE_MAX_ENTRIES; i++) await cachedRpc(`old${i}`, 10, async () => i);
    vi.advanceTimersByTime(50);
    await cachedRpc("live", 60_000, async () => "x");
    expect(rpcCacheSize()).toBe(1);
    for (let i = 0; i < RPC_CACHE_MAX_ENTRIES * 2; i++) await cachedRpc(`n${i}`, 60_000, async () => i);
    expect(rpcCacheSize()).toBeLessThanOrEqual(RPC_CACHE_MAX_ENTRIES);
  });
});
