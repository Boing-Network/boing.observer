import { afterEach, describe, expect, it, vi } from "vitest";
import { BoingRpcCallError, describeRpcRejection, rpcErrorReason, toRpcErrorLike } from "./rpc-error";
import { getFriendlyRpcErrorMessage } from "./rpc-status";
import { mapWalletErrorToUi } from "./boing-wallet";
import { rpcCall } from "./rpc-client";

const rejection = (data: Record<string, unknown>, code = -32000) =>
  new BoingRpcCallError("rejected", { code, data, method: "boing_submitTransaction" });

describe("describeRpcRejection", () => {
  it("unknown_sender", () => {
    expect(describeRpcRejection(rejection({ reason: "unknown_sender" }))).toMatch(/no balance on-chain|faucet/i);
  });

  it("stale_nonce reports expected and got", () => {
    const msg = describeRpcRejection(rejection({ reason: "stale_nonce", expected_nonce: 7, got_nonce: 5 }));
    expect(msg).toMatch(/nonce 7/);
    expect(msg).toMatch(/used 5/);
  });

  it("insufficient_fee formats have/need in BOING", () => {
    const msg = describeRpcRejection(
      rejection({ reason: "insufficient_fee", have: "100000000000000", need: "210000000000000" }),
    );
    expect(msg).toContain("0.0001 BOING");
    expect(msg).toContain("0.00021 BOING");
  });

  it("insufficient_fee without amounts still explains", () => {
    expect(describeRpcRejection(rejection({ reason: "insufficient_fee" }))).toMatch(/Not enough BOING/);
  });

  it("other reasons and numeric codes", () => {
    expect(describeRpcRejection(rejection({ reason: "already_in_mempool" }))).toMatch(/already pending/);
    expect(describeRpcRejection(rejection({ reason: "native_value_not_active" }))).toMatch(/not active/);
    expect(describeRpcRejection(new BoingRpcCallError("x", { code: -32016 }))).toMatch(/rate-limited/);
    expect(describeRpcRejection(new BoingRpcCallError("x", { code: -32050, data: { rule_id: "R1", message: "bad" } }))).toMatch(/R1/);
    expect(describeRpcRejection(new BoingRpcCallError("x", { code: -32053 }))).toMatch(/not eligible/);
  });

  it("returns null for unrecognised or non-error input", () => {
    expect(describeRpcRejection(new Error("boom"))).toBeNull();
    expect(describeRpcRejection(null)).toBeNull();
    expect(describeRpcRejection("string")).toBeNull();
    expect(describeRpcRejection(rejection({ reason: "something_new" }))).toBeNull();
  });

  it("understands the wallet's nested data.rpc shape and raw error objects", () => {
    const walletErr = { message: "wallet", data: { rpc: { code: -32000, message: "n", data: { reason: "unknown_sender" } } } };
    expect(rpcErrorReason(walletErr)).toBe("unknown_sender");
    expect(toRpcErrorLike({ code: -32000, message: "m", data: { reason: "stale_nonce" } })?.code).toBe(-32000);
    expect(mapWalletErrorToUi(walletErr)).toMatch(/no balance on-chain/i);
  });
});

describe("getFriendlyRpcErrorMessage", () => {
  it("prefers the structured rejection over the raw node message", () => {
    const e = new BoingRpcCallError("insufficient balance for fee: have 1, need 2", {
      code: -32000,
      data: { reason: "insufficient_fee", have: "1", need: "2" },
    });
    expect(getFriendlyRpcErrorMessage(e, "testnet", "general")).toMatch(/Not enough BOING/);
  });

  it("explains proxy rate limiting with Retry-After", () => {
    const e = new BoingRpcCallError("RPC HTTP 429: Too Many Requests", { httpStatus: 429, retryAfterSeconds: 12 });
    expect(getFriendlyRpcErrorMessage(e, "testnet", "general")).toMatch(/12 seconds/);
  });

  it("keeps the unreachable message for transport errors", () => {
    expect(getFriendlyRpcErrorMessage(new Error("Failed to fetch"), "testnet")).toMatch(/not yet available/);
  });
});

describe("rpcCall preserves code and data", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers })),
    );
  }

  it("throws BoingRpcCallError with code + data.reason", async () => {
    stubFetch({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32000, message: "stale", data: { reason: "stale_nonce", expected_nonce: 3, got_nonce: 2 } },
    });
    const err = await rpcCall("testnet", "https://rpc.example", "boing_submitTransaction", ["0x00"]).catch((e) => e);
    expect(err).toBeInstanceOf(BoingRpcCallError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(-32000);
    expect(err.data).toEqual({ reason: "stale_nonce", expected_nonce: 3, got_nonce: 2 });
    expect(err.method).toBe("boing_submitTransaction");
    expect(rpcErrorReason(err)).toBe("stale_nonce");
  });

  it("surfaces HTTP status and Retry-After on 429", async () => {
    stubFetch({ error: "rate limited" }, { status: 429, headers: { "retry-after": "9" } });
    const err = await rpcCall("testnet", "https://rpc.example", "boing_chainHeight", [], true).catch((e) => e);
    expect(err).toBeInstanceOf(BoingRpcCallError);
    expect(err.httpStatus).toBe(429);
    expect(err.retryAfterSeconds).toBe(9);
  });

  it("still returns result on success", async () => {
    stubFetch({ jsonrpc: "2.0", id: 1, result: 42 });
    await expect(rpcCall("testnet", "https://rpc.example", "boing_chainHeight", [])).resolves.toBe(42);
  });
});