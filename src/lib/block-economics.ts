/**
 * Derive staking / transfer signals from recent blocks (no global TVL RPC on Boing today).
 */

import type { Block, BlockTransaction } from "./rpc-types";
import { hexForLink } from "./rpc-types";
import { getTxPayloadKind, getTxPayloadInner } from "./tx-payload";

export type BlockEconomicsRow = {
  height: number;
  timestamp: number;
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
      timestamp: block.header.timestamp != null ? Number(block.header.timestamp) : 0,
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

/** Seconds between consecutive sampled blocks (skips the oldest, which has no predecessor in-window). */
export function blockIntervalSeries(
  rows: BlockEconomicsRow[]
): { height: number; intervalSec: number }[] {
  const out: { height: number; intervalSec: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].timestamp;
    const ts = rows[i].timestamp;
    if (ts > 0 && prev > 0 && ts >= prev) {
      out.push({ height: rows[i].height, intervalSec: ts - prev });
    }
  }
  return out;
}

export type ProposerShareRow = { proposer: string; count: number };

/** Block-header proposers in the sample, highest count first. */
export function proposerShare(blocks: Block[]): ProposerShareRow[] {
  const counts = new Map<string, number>();
  for (const b of blocks) {
    if (!b?.header) continue;
    const id = hexForLink(b.header.proposer);
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([proposer, count]) => ({ proposer, count }))
    .sort((a, b) => b.count - a.count || a.proposer.localeCompare(b.proposer));
}

/** Running sum of transfer payload amounts (not tx count). */
export function cumulativeTransferSeries(
  rows: BlockEconomicsRow[]
): { height: number; cumulative: bigint }[] {
  let run = BigInt(0);
  return rows.map((r) => {
    run += r.transferVolume;
    return { height: r.height, cumulative: run };
  });
}

/** Compact duration for liveness charts (seconds → s / m / h / d). */
export function formatIntervalLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 90) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  if (sec < 3600) {
    const m = sec / 60;
    return m < 10 ? `${m.toFixed(1)}m` : `${Math.round(m)}m`;
  }
  if (sec < 86400) {
    const h = sec / 3600;
    return h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
  }
  const d = sec / 86400;
  return d < 10 ? `${d.toFixed(1)}d` : `${Math.round(d)}d`;
}

/** Y-axis scale so multi-hour stalls remain readable. */
export function intervalAxisScale(maxSec: number): { divisor: number; unit: "s" | "m" | "h" } {
  if (maxSec >= 3600) return { divisor: 3600, unit: "h" };
  if (maxSec >= 180) return { divisor: 60, unit: "m" };
  return { divisor: 1, unit: "s" };
}
