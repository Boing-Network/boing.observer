import { afterEach, describe, expect, it } from "vitest";
import { getTestnetRpcCandidates, HOSTED_TESTNET_RPC_FALLBACKS } from "./rpc-client";

describe("getTestnetRpcCandidates", () => {
  const prevPrimary = process.env.NEXT_PUBLIC_TESTNET_RPC;
  const prevFallbacks = process.env.NEXT_PUBLIC_TESTNET_RPC_FALLBACKS;

  afterEach(() => {
    if (prevPrimary === undefined) delete process.env.NEXT_PUBLIC_TESTNET_RPC;
    else process.env.NEXT_PUBLIC_TESTNET_RPC = prevPrimary;
    if (prevFallbacks === undefined) delete process.env.NEXT_PUBLIC_TESTNET_RPC_FALLBACKS;
    else process.env.NEXT_PUBLIC_TESTNET_RPC_FALLBACKS = prevFallbacks;
  });

  it("includes the public hostname then hosted Fly backends", () => {
    delete process.env.NEXT_PUBLIC_TESTNET_RPC;
    delete process.env.NEXT_PUBLIC_TESTNET_RPC_FALLBACKS;
    expect(getTestnetRpcCandidates()).toEqual([
      "https://testnet-rpc.boing.network",
      ...HOSTED_TESTNET_RPC_FALLBACKS,
    ]);
  });

  it("dedupes when the primary is already a Fly origin", () => {
    process.env.NEXT_PUBLIC_TESTNET_RPC = "https://boing-testnet-1.fly.dev/";
    delete process.env.NEXT_PUBLIC_TESTNET_RPC_FALLBACKS;
    expect(getTestnetRpcCandidates()).toEqual([...HOSTED_TESTNET_RPC_FALLBACKS]);
  });
});
