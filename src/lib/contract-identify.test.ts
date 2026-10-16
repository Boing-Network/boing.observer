import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/testnet-contracts-rpc.json";
import { lookupContractCode } from "./contract-code-lookup";
import { identifyContract } from "./contract-identify";
import { CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX, CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX, boingPoolBytecodeHex } from "boing-sdk";

/** RPC replay from live testnet responses (captured 2026-10-16; deployer transfer rows trimmed). */
const replay = new Map(Object.entries(fixture as Record<string, unknown>).map(([k, v]) => [JSON.stringify(JSON.parse(k)), v]));
const rpc = async <T,>(method: string, params: unknown[]): Promise<T> => {
  const key = JSON.stringify([method, params]);
  if (!replay.has(key)) throw new Error(`no fixture for ${key.slice(0, 120)}`);
  return replay.get(key) as T;
};

const USDC = "6676f971ade3982406efa3e2cdb0477923f8f2a15624c4b6ad3a432817a75e93";
const POOL_V9 = "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61";
const ROUTER = "806b2462b28f2f5772bbf5ae2628ad3a333bd2c5fa341144e0400ef5c2f1e4c6";
const VAULT = "236a851dd50faaa268e2e1b7ba95cfb9993773abf63a4c0d949183d8302e65c7";
const hex = (xs: number[]) => xs.map((s) => s.toString(16));

describe("lookupContractCode + identifyContract (testnet replay)", () => {
  it.each([
    [USDC, "fungible-v2", ["1", "2", "8", "9", "a"]],
    [POOL_V9, "pool-custody", ["10", "11", "12", "13", "14", "15", "16", "17"]],
    [ROUTER, "custody-router", ["f1"]],
    [VAULT, "lp-vault-v2", ["c0", "c1", "c2", "c3"]],
  ])("%s", async (addr, iface, selectors) => {
    const look = await lookupContractCode(rpc, addr, { extraDeployers: [CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX] });
    expect(look.calledAsContract).toBe(true);
    expect(look.code).not.toBeNull();
    const id = identifyContract({ network: "testnet", address64: addr, code: look.code });
    expect(id.interfaceId).toBe(iface);
    expect(hex(id.decodedSelectors)).toEqual(selectors);
    expect(id.unknownSelectors).toEqual([]);
    // Without the canonical address table the bytecode alone still identifies it.
    const anon = identifyContract({ network: "mainnet", address64: addr, code: look.code });
    expect(anon.interfaceId).toBe(iface);
    expect(["bytecode", "selectors"]).toContain(anon.source);
  });

  it("canonical ledger pool v1 lists only the selectors its bytecode implements", () => {
    const pool = identifyContract({
      network: "testnet",
      address64: CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX,
      code: { bytecodeHex: boingPoolBytecodeHex(1), deployer: "00".repeat(32), height: 2, txIndex: 0 },
    });
    expect(pool.source).toBe("canonical");
    expect(pool.functions.map((f) => f.name)).toEqual(["swap", "add_liquidity", "remove_liquidity"]);
  });
});