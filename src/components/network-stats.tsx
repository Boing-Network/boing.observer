"use client";

import { useMemo } from "react";
import { useHomeChainData } from "@/context/home-chain-data";
import {
  computeNetworkStats,
  formatStatValue,
  type NetworkStats as NetworkStatsData,
} from "@/lib/network-stats";

const BLOCKS_TO_SAMPLE = 20;

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}

function StatCard({ label, value, sub, loading }: StatCardProps) {
  return (
    <div
      className="glass-card flex min-w-0 flex-col gap-1 p-4"
      role="group"
      aria-label={`${label}: ${loading ? "Loading" : value}`}
    >
      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
      {loading ? (
        <span className="font-mono text-lg text-[var(--text-muted)] animate-pulse">
          —
        </span>
      ) : (
        <span className="font-mono text-lg font-semibold text-network-cyan">
          {value}
        </span>
      )}
      {sub && (
        <span className="text-xs text-[var(--text-muted)]">{sub}</span>
      )}
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

  return (
    <div className="py-2" role="region" aria-label="Summary statistics">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Block height"
          value={stats?.blockHeight != null ? stats.blockHeight.toLocaleString() : "—"}
          loading={loading}
        />
        <StatCard
          label="Avg block time"
          value={formatStatValue(stats?.avgBlockTimeSec ?? null)}
          sub="seconds"
          loading={loading}
        />
        <StatCard
          label="TPS"
          value={formatStatValue(stats?.tps ?? null)}
          sub="tx/sec"
          loading={loading}
        />
        <StatCard
          label="Transactions"
          value={
            stats?.txCountLastN != null
              ? stats.txCountLastN.toLocaleString()
              : "—"
          }
          sub={`last ${BLOCKS_TO_SAMPLE} blocks`}
          loading={loading}
        />
      </div>
    </div>
  );
}
