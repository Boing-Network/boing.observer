/**
 * Derive staking / transfer signals from recent blocks (no global TVL RPC on Boing today).
 */

import type { Block, BlockTransaction } from "./rpc-types";
import { hexForLink } from "./rpc-types";
import { getTxPayloadKind, getTxPayloadInner } from "./tx-payload";

export type BlockEconomicsRow = {
  height: number;
  bond: bigint;
  unbond: bigint;
  transferVolume: bigint;
  bondTxs: number;
  unbondTxs: number;
  transferTxs: number;
};

export type BlockEconomicsTotals = {
  bond: bigint;
  unbond: bigint;
  transferVolume: bigint;
  netStakeFlow: bigint;
  uniqueProposers: number;
  blocksSampled: number;
  /** Count of txs by payload kind in the sampled blocks (each tx is one kind). */
  txCounts: {
    bond: number;
    unbond: number;
    transfer: number;
    other: number;
    total: number;
  };
};

function safeU128BigInt(raw: unknown): bigint {
  const s = String(raw ?? "0").trim();
  if (!/^\d+$/.test(s)) return BigInt(0);
  try {
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

function txContribution(tx: BlockTransaction): {
  bond: bigint;
  unbond: bigint;
  transfer: bigint;
  bondTxs: number;
  unbondTxs: number;
  transferTxs: number;
} {
  const kind = getTxPayloadKind(tx.payload);
  const p = getTxPayloadInner(tx.payload);
  let bond = BigInt(0);
  let unbond = BigInt(0);
  let transfer = BigInt(0);
  let bondTxs = 0;
  let unbondTxs = 0;
  let transferTxs = 0;
  switch (kind) {
    case "Bond":
      bond = safeU128BigInt(p.amount);
      bondTxs = 1;
      break;
    case "Unbond":
      unbond = safeU128BigInt(p.amount);
      unbondTxs = 1;
      break;
    case "Transfer":
      transfer = safeU128BigInt(p.amount);
      transferTxs = 1;
      break;
    default:
      break;
  }
  return { bond, unbond, transfer, bondTxs, unbondTxs, transferTxs };
}

/** Convert bigint BOING units to a finite number for charts (testnet-safe; may lose precision for huge values). */
export function bigIntToChartNumber(b: bigint): number {
  if (b === BigInt(0)) return 0;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const million = BigInt(1000000);
  if (b > max) return Number(b / million) * 1e6;
  return Number(b);
}

export function analyzeBlockEconomics(blocks: Block[]): { rows: BlockEconomicsRow[]; totals: BlockEconomicsTotals } {
  const sorted = [...blocks]
    .filter((b): b is Block => b != null && "header" in b)
    .sort((a, b) => (a.header?.height ?? 0) - (b.header?.height ?? 0));

  const proposers = new Set<string>();
  let bondT = BigInt(0);
  let unbondT = BigInt(0);
  let transferT = BigInt(0);

  const rows: BlockEconomicsRow[] = sorted.map((block) => {
    proposers.add(hexForLink(block.header.proposer));

    let bond = BigInt(0);
    let unbond = BigInt(0);
    let transferVolume = BigInt(0);
    let bondTxs = 0;
    let unbondTxs = 0;
    let transferTxs = 0;

    for (const tx of block.transactions ?? []) {
      const c = txContribution(tx);
      bond += c.bond;
      unbond += c.unbond;
      transferVolume += c.transfer;
      bondTxs += c.bondTxs;
      unbondTxs += c.unbondTxs;
      transferTxs += c.transferTxs;
    }

    bondT += bond;
    unbondT += unbond;
    transferT += transferVolume;

    return {
      height: block.header.height,
      bond,
      unbond,
      transferVolume,
      bondTxs,
      unbondTxs,
      transferTxs,
    };
  });

  const bondN = rows.reduce((s, r) => s + r.bondTxs, 0);
  const unbondN = rows.reduce((s, r) => s + r.unbondTxs, 0);
  const transferN = rows.reduce((s, r) => s + r.transferTxs, 0);
  const totalTxs = sorted.reduce((s, b) => s + (b.transactions?.length ?? 0), 0);
  const otherN = Math.max(0, totalTxs - bondN - unbondN - transferN);

  return {
    rows,
    totals: {
      bond: bondT,
      unbond: unbondT,
      transferVolume: transferT,
      netStakeFlow: bondT - unbondT,
      uniqueProposers: proposers.size,
      blocksSampled: rows.length,
      txCounts: {
        bond: bondN,
        unbond: unbondN,
        transfer: transferN,
        other: otherN,
        total: totalTxs,
      },
    },
  };
}

/** Cumulative net stake (bond − unbond) at each block in order. */
export function cumulativeNetStakeSeries(rows: BlockEconomicsRow[]): { height: number; cumulative: bigint }[] {
  let run = BigInt(0);
  return rows.map((r) => {
    run += r.bond - r.unbond;
    return { height: r.height, cumulative: run };
  });
}
