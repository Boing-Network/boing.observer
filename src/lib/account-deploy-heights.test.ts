import { describe, expect, it } from "vitest";
import { deployHeightsFromRows, fetchAccountDeployHeights } from "./account-deploy-heights";

describe("account deploy heights", () => {
  it("keeps outgoing deploys only, sorted and unique", () => {
    expect(
      deployHeightsFromRows([
        { block_height: 138, direction: "out", payload: { kind: "contract_deploy" } },
        { block_height: 65, direction: "out", payload: { kind: "contract_deploy" } },
        { block_height: 65, direction: "out", payload: { kind: "contract_deploy" } },
        { block_height: 70, direction: "in", payload: { kind: "transfer" } },
        { block_height: 81, direction: "out", payload: { kind: "contract_call" } },
      ]),
    ).toEqual([65, 138]);
  });

  it("pages with next_cursor and reports unsupported nodes", async () => {
    const pages = [
      { result: { transactions: [{ block_height: 138, direction: "out", payload: { kind: "contract_deploy" } }], next_cursor: "100:0" } },
      { result: { transactions: [{ block_height: 65, direction: "out", payload: { kind: "contract_deploy" } }], next_cursor: null } },
    ];
    let i = 0;
    const ok = await fetchAccountDeployHeights("http://x", "0xab", {
      fetchImpl: (async () => ({ json: async () => pages[i++] })) as unknown as typeof fetch,
    });
    expect(ok).toEqual({ supported: true, heights: [65, 138], scannedTxs: 2 });
    const old = await fetchAccountDeployHeights("http://x", "0xab", {
      fetchImpl: (async () => ({ json: async () => ({ error: { code: -32601 } }) })) as unknown as typeof fetch,
    });
    expect(old.supported).toBe(false);
  });
});