"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNetwork } from "@/context/network-context";
import { fetchChainHeight, fetchBlockByHeight } from "@/lib/rpc-methods";
import type { Block } from "@/lib/rpc-types";
import {
  analyzeBlockEconomics,
  bigIntToChartNumber,
  cumulativeNetStakeSeries,
} from "@/lib/block-economics";
import { formatBoingAmount } from "@/lib/tx-payload";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";

const BLOCKS_TO_SAMPLE = 40;
const REFRESH_INTERVAL_MS = 45_000;

function InsightStat({
  label,
  value,
  sub,
  loading,
  tone = "cyan",
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  tone?: "cyan" | "primary" | "amber";
}) {
  const valueClass =
    tone === "primary"
      ? "text-network-primary-light"
      : tone === "amber"
        ? "text-amber-200"
        : "text-network-cyan";
  return (
    <div
      className="glass-card flex min-w-[130px] flex-1 flex-col gap-1 p-4 sm:min-w-[140px]"
      role="group"
      aria-label={`${label}: ${loading ? "Loading" : value}`}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {loading ? (
        <span className="animate-pulse font-mono text-lg text-[var(--text-muted)]">—</span>
      ) : (
        <span className={`font-mono text-lg font-semibold ${valueClass}`}>{value}</span>
      )}
      {sub ? <span className="text-xs text-[var(--text-muted)]">{sub}</span> : null}
    </div>
  );
}

function formatBig(b: bigint): string {
  return `${formatBoingAmount(b.toString())} BOING`;
}

export function NetworkEconomyInsights() {
  const { network } = useNetwork();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const h = await fetchChainHeight(network);
      const heights = Array.from({ length: BLOCKS_TO_SAMPLE }, (_, i) => Math.max(0, h - i));
      const fetched = await Promise.all(heights.map((height) => fetchBlockByHeight(network, height)));
      const valid = fetched.filter((b): b is Block => b != null && "hash" in b && "header" in b);
      setBlocks(valid);
    } catch (e) {
      setError(getFriendlyRpcErrorMessage(e, network, "stats"));
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const { rows, totals } = useMemo(() => analyzeBlockEconomics(blocks), [blocks]);
  const cumulative = useMemo(() => cumulativeNetStakeSeries(rows), [rows]);

  const chartRows = useMemo(
    () =>
      rows.map((r) => ({
        height: r.height,
        bond: bigIntToChartNumber(r.bond),
        unbond: bigIntToChartNumber(r.unbond),
        bondTxs: r.bondTxs,
        unbondTxs: r.unbondTxs,
      })),
    [rows]
  );

  const cumulativeChart = useMemo(
    () =>
      cumulative.map((p) => ({
        height: p.height,
        cumulative: bigIntToChartNumber(p.cumulative),
      })),
    [cumulative]
  );

  if (error) {
    return (
      <div className="py-2" role="region" aria-label="Network economy insights">
        <div className="glass-card border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" role="region" aria-labelledby="economy-insights-heading">
      <div>
        <h3 id="economy-insights-heading" className="font-display text-base font-semibold text-[var(--text-primary)]">
          Staking &amp; transfer activity
        </h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-muted)]">
          Totals below sum <strong className="text-[var(--text-secondary)]">Bond</strong>,{" "}
          <strong className="text-[var(--text-secondary)]">Unbond</strong>, and{" "}
          <strong className="text-[var(--text-secondary)]">Transfer</strong> payloads in the last{" "}
          {BLOCKS_TO_SAMPLE} blocks. They are <strong className="text-[var(--text-secondary)]">not</strong>{" "}
          chain-wide TVL. Global stake and staking APY are not returned by the public RPC this explorer uses.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <InsightStat
          label="Net stake flow"
          value={loading ? "—" : formatBig(totals.netStakeFlow)}
          sub="Bond − unbond (window)"
          loading={loading}
          tone={
            loading
              ? "cyan"
              : totals.netStakeFlow > BigInt(0)
                ? "primary"
                : totals.netStakeFlow < BigInt(0)
                  ? "amber"
                  : "cyan"
          }
        />
        <InsightStat
          label="Bonded"
          value={loading ? "—" : formatBig(totals.bond)}
          sub={`${rows.reduce((s, r) => s + r.bondTxs, 0)} txs`}
          loading={loading}
          tone="primary"
        />
        <InsightStat
          label="Unbonded"
          value={loading ? "—" : formatBig(totals.unbond)}
          sub={`${rows.reduce((s, r) => s + r.unbondTxs, 0)} txs`}
          loading={loading}
          tone="amber"
        />
        <InsightStat
          label="Transfer volume"
          value={loading ? "—" : formatBig(totals.transferVolume)}
          sub={`${rows.reduce((s, r) => s + r.transferTxs, 0)} transfers`}
          loading={loading}
        />
        <InsightStat
          label="Active proposers"
          value={loading ? "—" : totals.uniqueProposers.toLocaleString()}
          sub={`in ${totals.blocksSampled} blocks`}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-4">
          <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">Bond vs unbond per block</h4>
          <p className="mb-3 text-xs text-[var(--text-muted)]">BOING units (chart may round large values)</p>
          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-[var(--text-muted)]">Loading…</div>
          ) : chartRows.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-[var(--text-muted)]">No data</div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                  <XAxis
                    dataKey="height"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickFormatter={(v) => `#${Number(v).toLocaleString()}`}
                  />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--boing-navy-deep)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "var(--text-primary)" }}
                    formatter={(value, name) => {
                      const v = typeof value === "number" ? value : 0;
                      const label = name === "bond" ? "Bond" : "Unbond";
                      return [`${formatBoingAmount(String(Math.round(v)))} BOING`, label];
                    }}
                    labelFormatter={(h) => `Block #${Number(h).toLocaleString()}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => (value === "bond" ? "Bond" : "Unbond")}
                  />
                  <Bar dataKey="bond" fill="var(--network-primary-light)" radius={[2, 2, 0, 0]} name="bond" />
                  <Bar dataKey="unbond" fill="rgba(251, 191, 36, 0.85)" radius={[2, 2, 0, 0]} name="unbond" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">Cumulative net stake (window)</h4>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Running bond − unbond over sampled blocks</p>
          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-[var(--text-muted)]">Loading…</div>
          ) : cumulativeChart.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-[var(--text-muted)]">No data</div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                  <XAxis
                    dataKey="height"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickFormatter={(v) => `#${Number(v).toLocaleString()}`}
                  />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--boing-navy-deep)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "var(--text-primary)" }}
                    formatter={(value) => {
                      const v = typeof value === "number" ? value : 0;
                      return [`${formatBoingAmount(String(Math.round(v)))} BOING`, "Net (Σ)"];
                    }}
                    labelFormatter={(h) => `Block #${Number(h).toLocaleString()}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="var(--network-cyan)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <aside className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-xs text-[var(--text-muted)]">
        <strong className="text-[var(--text-secondary)]">TVL &amp; APY:</strong> Total staked supply and reward rate need
        protocol-level or archive APIs. When Boing exposes them on RPC, they can appear here without double-counting
        window sums.
      </aside>
    </div>
  );
}
