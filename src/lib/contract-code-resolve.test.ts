import { describe, expect, it } from "vitest";
import { fetchContractCodeRpc, resolveContractCode } from "./contract-code-lookup";

const ADDR = "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61";

function rpcWith(handlers: Record<string, (params: unknown[]) => unknown>) {
  return async <T,>(method: string, params: unknown[]): Promise<T> => {
    const h = handlers[method];
    if (!h) throw new Error(`Method not found: ${method}`);
    return h(params) as T;
  };
}

describe("boing_getContractCode resolution", () => {
  it("returns bytecode + code hash from the RPC", async () => {
    const rpc = rpcWith({
      boing_getContractCode: () => ({ bytecode: "0x6001", code_hash: "0x" + "ab".repeat(32), size: 2 }),
      boing_getAccountTransactions: () => ({ transactions: [], next_cursor: null }),
    });
    expect(await fetchContractCodeRpc(rpc, ADDR)).toEqual({ bytecodeHex: "6001", codeHash: "ab".repeat(32), size: 2 });
    const r = await resolveContractCode(rpc, ADDR);
    expect(r.codeVia).toBe("rpc");
    expect(r.code).toMatchObject({ bytecodeHex: "6001", codeHash: "ab".repeat(32), deployer: null, via: "rpc" });
  });

  it("null result means no contract code", async () => {
    const rpc = rpcWith({
      boing_getContractCode: () => null,
      boing_getAccountTransactions: () => ({ transactions: [], next_cursor: null }),
    });
    expect(await fetchContractCodeRpc(rpc, ADDR)).toBeNull();
    const r = await resolveContractCode(rpc, ADDR);
    expect(r.code).toBeNull();
    expect(r.codeVia).toBe("none");
  });

  it("falls back to the history search when the method is unavailable", async () => {
    const rpc = rpcWith({ boing_getAccountTransactions: () => ({ transactions: [], next_cursor: null }) });
    expect(await fetchContractCodeRpc(rpc, ADDR)).toBe("unsupported");
    const r = await resolveContractCode(rpc, ADDR);
    expect(r.codeVia).toBe("none");
    expect(r.code).toBeNull();
  });
});