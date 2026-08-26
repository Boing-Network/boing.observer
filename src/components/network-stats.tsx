"use client";

import { useMemo } from "react";
import { useHomeChainData } from "@/context/home-chain-data";
import { formatIntervalLabel } from "@/lib/block-economics";
import { computeNetworkStats, type NetworkStats as NetworkStatsData } from "@/lib/network-stats";
import { formatBoingAmount } from "@/lib/tx-payload";

const BLOCKS_TO_SAMPLE = 20;

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="glass-card flex min-w-0 flex-col gap-1 p-4"
      role="group"
      aria-label={`${label}: ${loading ? "Loading" : value}`}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {loading ? (
        <span className="animate-pulse font-mono text-lg text-[var(--text-muted)]">—</span>
      ) : (
        <span className="font-mono text-lg font-semibold text-network-cyan">{value}</span>
      )}
      {sub ? <span className="text-xs text-[var(--text-muted)]">{sub}</span> : null}
    </div>
  );
}

export function NetworkStats() {
  const { tipHeight, sliceBlocks, loading, error } = useHomeChainData();

  const stats = useMemo((): NetworkStatsData | null => {
    if (tipHeight == null) return null;
    return computeNetworkStats(tipHeight, sliceBlocks(BLOCKS_TO_SAMPLE));
  }, [tipHeight, sliceBlocks]);

  if (error && !stats) {
    return (
      <div className="py-2" role="region" aria-label="Network statistics">
        <div className="glass-card border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200" role="alert">
          {error}
        </div>
      </div>
    );
  }

  const moved =
    stats != null ? `${formatBoingAmount(stats.boingMoved.toString())} BOING` : "—";

  return (
    <div className="py-2" role="region" aria-label="Summary statistics">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Block height"
          value={stats?.blockHeight != null ? stats.blockHeight.toLocaleString() : "—"}
          loading={loading}
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
          sub={`transfers + stake in last ${stats?.blocksSampled ?? BLOCKS_TO_SAMPLE} blocks`}
          loading={loading}
        />
      </div>
    </div>
  );
}