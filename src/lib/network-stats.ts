/**
 * Compute network statistics from recent blocks.
 */

import type { Block } from "./rpc-types";
import { analyzeBlockEconomics } from "./block-economics";

export interface NetworkStats {
  blockHeight: number | null;
  avgBlockTimeSec: number | null;
  secondsSinceLastBlock: number | null;
  boingMoved: bigint;
  uniqueProposers: number;
  blocksSampled: number;
}

export function computeNetworkStats(
  height: number | null,
  blocks: Block[],
  nowSec: number = Date.now() / 1000
): NetworkStats {
  const { rows, totals } = analyzeBlockEconomics(blocks);
  const boingMoved = totals.transferVolume + totals.bond + totals.unbond;
  const uniqueProposers = totals.uniqueProposers;

  if (!height || rows.length < 2) {
    const lastTs = rows.reduce((m, r) => (r.timestamp > m ? r.timestamp : m), 0);
    return {
      blockHeight: height ?? null,
      avgBlockTimeSec: null,
      secondsSinceLastBlock: lastTs > 0 ? Math.max(0, nowSec - lastTs) : null,
      boingMoved,
      uniqueProposers,
      blocksSampled: rows.length,
    };
  }

  const timestamps = rows.map((r) => r.timestamp).filter((t) => t > 0);
  let avgBlockTimeSec: number | null = null;
  let secondsSinceLastBlock: number | null = null;

  if (timestamps.length >= 2) {
    const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
    avgBlockTimeSec = timeSpan / (timestamps.length - 1);
  }
  if (timestamps.length >= 1) {
    secondsSinceLastBlock = Math.max(0, nowSec - timestamps[timestamps.length - 1]);
  }

  return {
    blockHeight: height,
    avgBlockTimeSec,
    secondsSinceLastBlock,
    boingMoved,
    uniqueProposers,
    blocksSampled: rows.length,
  };
}