import { describe, expect, it } from "vitest";
import { ALLOWED_RPC_METHODS, MAX_RPC_PARAMS, validateProxyRequest } from "./rpc-proxy-policy";

describe("validateProxyRequest", () => {
  it("accepts an allowed method and forwards only the standard members", () => {
    const r = validateProxyRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "boing_getAccount",
      params: ["0xab"],
      evil: { x: 1 },
    });
    expect(r).toEqual({
      ok: true,
      request: { jsonrpc: "2.0", id: 7, method: "boing_getAccount", params: ["0xab"] },
    });
  });

  it("allows the fee policy method and defaults params to []", () => {
    expect(ALLOWED_RPC_METHODS.has("boing_getNetworkFeePolicy")).toBe(true);
    const r = validateProxyRequest({ jsonrpc: "2.0", id: 1, method: "boing_getNetworkFeePolicy" });
    expect(r.ok && r.request.params).toEqual([]);
  });

  it("rejects batches, non-objects and wrong jsonrpc versions", () => {
    for (const bad of [[], [{ jsonrpc: "2.0", method: "boing_health" }], null, "x", 3, { jsonrpc: "1.0", method: "boing_health" }]) {
      const r = validateProxyRequest(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kind).toBe("invalid");
    }
  });

  it("rejects malformed method names and non-allow-listed methods", () => {
    expect(validateProxyRequest({ jsonrpc: "2.0", method: "../x" })).toMatchObject({ ok: false, kind: "invalid" });
    expect(validateProxyRequest({ jsonrpc: "2.0", method: "boing_sendTransaction", id: 4 })).toEqual({
      ok: false,
      kind: "method_not_allowed",
      method: "boing_sendTransaction",
      id: 4,
    });
  });

  it("rejects non-array or oversized params", () => {
    expect(validateProxyRequest({ jsonrpc: "2.0", method: "boing_health", params: { a: 1 } })).toMatchObject({
      ok: false,
      kind: "invalid",
    });
    expect(
      validateProxyRequest({ jsonrpc: "2.0", method: "boing_health", params: new Array(MAX_RPC_PARAMS + 1).fill(0) }),
    ).toMatchObject({ ok: false, kind: "invalid" });
  });

  it("coerces non-integer ids to 0", () => {
    const r = validateProxyRequest({ jsonrpc: "2.0", id: "abc", method: "boing_health" });
    expect(r.ok && r.request.id).toBe(0);
  });
});
