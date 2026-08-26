import { describe, expect, it } from "vitest";
import {
  analyzeBlockEconomics,
  blockIntervalSeries,
  cumulativeTransferSeries,
  formatIntervalLabel,
  intervalAxisScale,
  proposerShare,
} from "./block-economics";
import { computeNetworkStats } from "./network-stats";
import type { Block } from "./rpc-types";

function block(height: number, timestamp: number, proposer: string, txs: Block["transactions"]): Block {
  return {
    hash: "aa".repeat(32),
    header: {
      parent_hash: "bb".repeat(32),
      height,
      timestamp,
      proposer,
      tx_root: "cc".repeat(32),
      state_root: "dd".repeat(32),
    },
    transactions: txs,
  };
}

const pA = "11".repeat(32);
const pB = "22".repeat(32);

describe("block-economics chart series", () => {
  it("measures idle gaps, not tx count", () => {
    const blocks = [
      block(1, 1000, pA, [{ sender: pA, payload: { Transfer: { to: pB, amount: "10" } } }]),
      block(2, 1005, pA, [{ sender: pA, payload: { Transfer: { to: pB, amount: "10" } } }]),
      block(3, 4605, pB, [{ sender: pA, payload: { Transfer: { to: pB, amount: "50" } } }]),
    ];
    const { rows, totals } = analyzeBlockEconomics(blocks);
    expect(totals.txCounts.total).toBe(3);
    expect(blockIntervalSeries(rows).map((p) => p.intervalSec)).toEqual([5, 3600]);
    expect(cumulativeTransferSeries(rows).map((p) => p.cumulative.toString())).toEqual(["10", "20", "70"]);
    expect(proposerShare(blocks)).toEqual([
      { proposer: pA, count: 2 },
      { proposer: pB, count: 1 },
    ]);
  });

  it("formats long stalls in hours", () => {
    expect(formatIntervalLabel(12.4)).toBe("12s");
    expect(formatIntervalLabel(3600)).toBe("1.0h");
    expect(intervalAxisScale(4000).unit).toBe("h");
    expect(intervalAxisScale(12).unit).toBe("s");
  });
});

describe("computeNetworkStats", () => {
  it("reports BOING moved instead of TPS", () => {
    const blocks = [
      block(1, 1000, pA, [{ sender: pA, payload: { Transfer: { to: pB, amount: "7" } } }]),
      block(2, 1010, pA, [{ sender: pA, payload: { Bond: { amount: "3" } } }]),
    ];
    const s = computeNetworkStats(2, blocks, 1015);
    expect(s.boingMoved.toString()).toBe("10");
    expect(s.uniqueProposers).toBe(1);
    expect(s.avgBlockTimeSec).toBe(10);
    expect(s.secondsSinceLastBlock).toBe(5);
    expect(s).not.toHaveProperty("tps");
  });
});
