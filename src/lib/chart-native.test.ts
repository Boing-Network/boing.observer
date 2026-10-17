import { describe, expect, it } from "vitest";
import { analyzeBlockEconomics, cumulativeTransferSeries } from "./block-economics";
import { blockValueSeries, blockValueTooltip, boingTooltipValue, compactBoingAxis } from "./chart-native";
import type { Block } from "./rpc-types";

const B = BigInt("1000000000000000000");
const pA = "11".repeat(32);
const pB = "22".repeat(32);
const transferBlock = (height: number, amount: string): Block => ({
  hash: "aa".repeat(32),
  header: { parent_hash: "bb".repeat(32), height, timestamp: 1000 + height, proposer: pA, tx_root: "cc".repeat(32), state_root: "dd".repeat(32) },
  transactions: [{ sender: pA, payload: { Transfer: { to: pB, amount } } }],
});

// Live testnet shape: faucet drips of 20 BOING, whole units below 1050, base units from it (1052 = 2e19).
const blocks = [
  transferBlock(1014, "20"),
  transferBlock(1049, "20"),
  transferBlock(1050, (BigInt(20) * B).toString()),
  transferBlock(1052, "20000000000000000000"),
];

describe("BOING moved per block chart across the 1050 switch", () => {
  const { rows } = analyzeBlockEconomics(blocks);
  const series = blockValueSeries(rows);

  it("plots every block as 20 BOING (no raw base units)", () => {
    expect(series.map((p) => [p.height, p.transfer])).toEqual([
      [1014, 20],
      [1049, 20],
      [1050, 20],
      [1052, 20],
    ]);
  });

  it("tooltip at block 1052 reads 'Transfer: 20 BOING'", () => {
    const p = series.find((x) => x.height === 1052)!;
    const [value, label] = blockValueTooltip("transfer", p);
    expect(`${label}: ${value}`).toBe("Transfer: 20 BOING");
    const below = series.find((x) => x.height === 1049)!;
    expect(blockValueTooltip("transfer", below)).toEqual(["20 BOING", "Transfer"]);
  });

  it("cumulative transfers are 80 BOING", () => {
    const cum = cumulativeTransferSeries(rows);
    expect(boingTooltipValue(cum[cum.length - 1]!.cumulative)).toBe("80 BOING");
  });

  it("compact axis labels", () => {
    expect([0, 5, 20, 0.5, 1500, 2_000_000, 2.5e9].map(compactBoingAxis)).toEqual(["0", "5", "20", "0.5", "1.5K", "2M", "2.5B"]);
    expect(compactBoingAxis(12.5)).toBe("12.5");
  });
});
