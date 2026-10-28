import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/testnet-swap-blocks-1334-1335.json";

const rpcCall = vi.fn();
vi.mock("./rpc-client", () => ({ rpcCall: (...a: unknown[]) => rpcCall(...a), getRpcBaseUrl: () => "http://rpc.test" }));

import { restoreBlockCalldata } from "./rpc-methods";
import type { Block } from "./rpc-types";

const full = (fixture as Record<string, { transactions: unknown[] }>)["1335"]!;
let nextHeight = 5000; // distinct heights: fetchBlockByHeight caches per height
const mk = (calldata: unknown) =>
  ({
    header: { height: ++nextHeight },
    transactions: [
      {
        sender: (full.transactions[0] as { sender: string }).sender,
        payload: { ContractCall: { contract: "0x" + "ab".repeat(32), calldata } },
      },
    ],
  }) as unknown as Block;

describe("restoreBlockCalldata", () => {
  beforeEach(() => rpcCall.mockReset());

  it("copies stubbed ContractCall calldata back from the include_code=true block", async () => {
    rpcCall.mockImplementation(async (_n: unknown, _b: unknown, method: string) =>
      method === "boing_getBlockByHeight" ? { header: { height: nextHeight + 1 }, transactions: full.transactions } : nextHeight + 10,
    );
    const slim = mk({ omitted: true, size: 288, hash: "0x00" });
    const out = (await restoreBlockCalldata("testnet", slim))!;
    const cd = (out.transactions[0]!.payload as { ContractCall: { calldata: unknown } }).ContractCall.calldata;
    expect(typeof cd).toBe("string");
    expect(rpcCall.mock.calls.filter((c) => c[2] === "boing_getBlockByHeight").length).toBe(1);
    expect(rpcCall.mock.calls.find((c) => c[2] === "boing_getBlockByHeight")![3]).toEqual([nextHeight]);
  });

  it("does nothing (no RPC) when calldata is already present", async () => {
    const b = mk("0x" + "00".repeat(32));
    expect(await restoreBlockCalldata("testnet", b)).toBe(b);
    expect(rpcCall).not.toHaveBeenCalled();
  });

  it("skips deploy-sized stubs and survives RPC failure", async () => {
    const big = mk({ omitted: true, size: 5_000_000 });
    expect(await restoreBlockCalldata("testnet", big)).toBe(big);
    expect(rpcCall).not.toHaveBeenCalled();
    rpcCall.mockImplementation(async (_n: unknown, _b: unknown, method: string) => {
      if (method === "boing_getBlockByHeight") throw new Error("gateway cap");
      return 99999;
    });
    const slim = mk({ omitted: true, size: 288 });
    expect(await restoreBlockCalldata("testnet", slim)).toBe(slim);
  });
});
