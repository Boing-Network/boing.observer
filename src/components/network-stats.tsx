"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useHomeChainData } from "@/context/home-chain-data";
import { useNetwork } from "@/context/network-context";
import { explorerBlockHeightHref } from "@/lib/explorer-href";
import { formatIntervalLabel } from "@/lib/block-economics";
import { computeNetworkStats, type NetworkStats as NetworkStatsData } from "@/lib/network-stats";
import { compactBoing } from "@/lib/native-unit";
import { RpcDownNotice, Skeleton } from "@/components/loading-states";

const BLOCKS_TO_SAMPLE = 20;

function StatCard({
  label,
  value,
  sub,
  loading,
  href,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  href?: string;
  /** Full value shown on hover when `value` is compacted. */
  title?: string;
}) {
  const valueNode = loading ? (
    <Skeleton className="mt-1 h-6 w-20" />
  ) : href ? (
    <Link href={href} title={title ?? value} className="block min-w-0 truncate font-mono text-lg font-semibold text-network-cyan hover:underline">
      {value}
    </Link>
  ) : (
    <span title={title ?? value} className="block min-w-0 truncate font-mono text-lg font-semibold text-network-cyan" data-testid="stat-value">
      {value}
    </span>
  );
  return (
    <div
      className="glass-card flex min-w-0 flex-col gap-1 p-4"
      role="group"
      aria-label={`${label}: ${loading ? "Loading" : value}`}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {valueNode}
      {sub ? <span className="break-words text-xs text-[var(--text-muted)]">{sub}</span> : null}
    </div>
  );
}

export function NetworkStats() {
  const { network } = useNetwork();
  const { tipHeight, sliceBlocks, loading, error } = useHomeChainData();

  const stats = useMemo((): NetworkStatsData | null => {
    if (tipHeight == null) return null;
    return computeNetworkStats(tipHeight, sliceBlocks(BLOCKS_TO_SAMPLE));
  }, [tipHeight, sliceBlocks]);

  if (error && !stats) {
    return (
      <div className="py-2" role="region" aria-label="Network statistics">
        <RpcDownNotice message={error} />
      </div>
    );
  }

  const moved =
    stats != null ? `${compactBoing(stats.boingMoved).short} BOING` : "—";
  const movedFull = stats != null ? `${compactBoing(stats.boingMoved).full} BOING` : undefined;

  return (
    <div className="py-2" role="region" aria-label="Summary statistics">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Block height"
          value={stats?.blockHeight != null ? stats.blockHeight.toLocaleString() : "—"}
          loading={loading}
          href={
            stats?.blockHeight != null ? explorerBlockHeightHref(stats.blockHeight, network) : undefined
          }
        />
        <StatCard
          label="Avg block interval"
          value={stats?.avgBlockTimeSec != null ? formatIntervalLabel(stats.avgBlockTimeSec) : "—"}
          sub="between sampled blocks"
          loading={loading}
        />
        <StatCard
          label="Since last block"
          value={
            stats?.secondsSinceLastBlock != null ? formatIntervalLabel(stats.secondsSinceLastBlock) : "—"
          }
          sub="from this browser clock"
          loading={loading}
        />
        <StatCard
          label="BOING moved"
          value={loading ? "—" : moved}
          title={movedFull}
          sub={`successful transfers + stake in last ${stats?.blocksSampled ?? BLOCKS_TO_SAMPLE} blocks (failed txs excluded)`}
          loading={loading}
        />
      </div>
    </div>
  );
}