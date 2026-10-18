import { describe, expect, it } from "vitest";
import { buildPayloadDetailLines } from "./tx-details";
import { rolesForAccountInTx } from "./account-tx-history";
import { batchSteps, getTxExplorerNarrative, getTxPayloadKind, getTxPayloadSummary } from "./tx-payload";

/** Shapes exactly as `boing_getBlockByHeight` returns them (testnet blocks 1155 and 1162). */
const bytes = (hex: string) => Array.from({ length: 32 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
const WBOING = "35555ffee114ba1698dcb6cd5f6d0ce56bf264dc6f386991c00cab22020d9c55";
const POOL = "23e9b02c3ee1600197e1a3d1c08feaa758b967f7ff1513f62991257a3b970069";
const ME = "8079f30559c02c5fe087c9ad1bc3b751a29de35992f3f8431734243e825f696e";
const deposit = Array.from({ length: 32 }, (_, i) => (i === 31 ? 32 : 0));

const wrap20 = { ContractCallWithValue: { calldata: deposit, contract: bytes(WBOING), value: "20000000000000000000" } };
const swapBatch = {
  Batch: {
    calls: [
      { ContractCallWithValue: { calldata: deposit, contract: bytes(WBOING), value: "1000000000000000000" } },
      { ContractCall: { calldata: [1, 2, 3], contract: bytes(WBOING) } },
      { ContractCall: { calldata: [4, 5], contract: bytes(POOL) } },
    ],
  },
};

describe("native BOING sent with contract calls", () => {
  it("ContractCallWithValue is a contract call that shows its BOING value", () => {
    expect(getTxPayloadKind(wrap20)).toBe("ContractCall");
    expect(getTxPayloadSummary(wrap20, 1155, "testnet")).toContain("sends 20 BOING");
    expect(getTxExplorerNarrative(ME, wrap20, 1155, "testnet")).toContain("sends 20 BOING");
    const lines = buildPayloadDetailLines(wrap20, 1155, "testnet");
    expect(lines.find((l) => l.label === "BOING sent to contract")?.value).toBe("20 BOING");
  });

  it("plain contract calls show no value line", () => {
    const call = { ContractCall: { calldata: [1], contract: bytes(POOL) } };
    expect(getTxPayloadSummary(call, 1162, "testnet")).not.toContain("sends");
    expect(buildPayloadDetailLines(call, 1162, "testnet").some((l) => l.label.startsWith("BOING sent"))).toBe(false);
  });

  it("batch steps list the value step and the total", () => {
    expect(getTxPayloadKind(swapBatch)).toBe("Batch");
    expect(batchSteps(swapBatch.Batch).map((s) => s.kind)).toEqual(["ContractCall", "ContractCall", "ContractCall"]);
    expect(getTxPayloadSummary(swapBatch, 1162, "testnet")).toBe("batch · 3 steps · sends 1 BOING");
    const lines = buildPayloadDetailLines(swapBatch, 1162, "testnet");
    expect(lines.find((l) => l.label === "Step 1")?.value).toContain("sends 1 BOING");
    expect(lines.find((l) => l.label === "Step 2")?.value).not.toContain("sends");
    expect(lines.find((l) => l.label === "BOING sent to contracts")?.value).toBe("1 BOING");
  });

  it("contracts called inside a batch get the contract role", () => {
    const tx = { sender: bytes(ME), payload: swapBatch, access_list: { read: [], write: [] } };
    expect(rolesForAccountInTx(POOL, tx as never)).toContain("contract");
    expect(rolesForAccountInTx(ME, tx as never)).toContain("sender");
  });
});
