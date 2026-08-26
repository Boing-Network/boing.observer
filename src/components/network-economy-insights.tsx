"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HOME_BLOCK_WINDOW, useHomeChainData } from "@/context/home-chain-data";
import { useNetwork } from "@/context/network-context";
import {
  analyzeBlockEconomics,
  bigIntToChartNumber,
  cumulativeTransferSeries,
  proposerShare,
} from "@/lib/block-economics";
import { explorerAccountHref } from "@/lib/explorer-href";
import { shortenHash } from "@/lib/rpc-types";
import { formatBoingAmount } from "@/lib/tx-payload";
import Link from "next/link";

const BLOCKS_TO_SAMPLE = HOME_BLOCK_WINDOW;

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

type VolPieRow = { name: string; value: number; fill: string; raw: bigint };

/** Integer slice weights for Recharts; avoids huge Number() on u128 totals. */
function volumePieWeights(bond: bigint, unbond: bigint, transfer: bigint): VolPieRow[] {
  const total = bond + unbond + transfer;
  if (total === BigInt(0)) return [];
  const w = (b: bigint) => Number((b * BigInt(100000)) / total);
  const rows: VolPieRow[] = [
    { name: "Bond", value: w(bond), fill: "var(--network-primary-light)", raw: bond },
    { name: "Unbond", value: w(unbond), fill: "rgba(251, 191, 36, 0.9)", raw: unbond },
    { name: "Transfer", value: w(transfer), fill: "var(--network-cyan)", raw: transfer },
  ];
  return rows.filter((r) => r.value > 0);
}

export function NetworkEconomyInsights() {
  const { network } = useNetwork();
  const { sliceBlocks, loading, error } = useHomeChainData();
  const blocks = sliceBlocks(BLOCKS_TO_SAMPLE);

  const { rows, totals } = useMemo(() => analyzeBlockEconomics(blocks), [blocks]);
  const cumulative = useMemo(() => cumulativeTransferSeries(rows), [rows]);

  const cumulativeChart = useMemo(
    () =>
      cumulative.map((p) => ({
        height: p.height,
        cumulative: bigIntToChartNumber(p.cumulative),
      })),
    [cumulative]
  );

  const proposerRows = useMemo(() => {
    const share = proposerShare(blocks);
    const limit = 8;
    const mapped = (share.length > limit ? share.slice(0, limit) : share).map((s) => ({
      label: shortenHash(s.proposer, 6, 4),
      proposer: s.proposer,
      count: s.count,
    }));
    if (share.length > limit) {
      const rest = share.slice(limit).reduce((n, s) => n + s.count, 0);
      mapped.push({ label: "Other", proposer: "", count: rest });
    }
    return mapped;
  }, [blocks]);

  const volPieData = useMemo(
    () => volumePieWeights(totals.bond, totals.unbond, totals.transferVolume),
    [totals.bond, totals.unbond, totals.transferVolume]
  );

  if (error && blocks.length === 0 && !loading) {
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
          chain-wide TVL. Charts show who produced those blocks and where BOING amounts went — not
          transaction counts.
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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-card p-4">
          <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">Who produced these blocks</h4>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Header proposers in the last {totals.blocksSampled} blocks
            {totals.uniqueProposers === 1 ? " — a single producer in this window" : ""}
          </p>
          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-[var(--text-muted)]">Loading…</div>
          ) : proposerRows.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-center text-sm text-[var(--text-muted)]">
              No proposers in sampled blocks.
            </div>
          ) : proposerRows.length === 1 ? (
            <div className="flex h-[240px] flex-col items-center justify-center gap-2 px-4 text-center">
              {proposerRows[0].proposer ? (
                <Link
                  href={explorerAccountHref(proposerRows[0].proposer, network)}
                  className="font-mono text-sm text-network-cyan hover:underline"
                >
                  {proposerRows[0].label}
                </Link>
              ) : (
                <p className="font-mono text-sm text-network-cyan">{proposerRows[0].label}</p>
              )}
              <p className="text-sm text-[var(--text-secondary)]">
                Produced every sampled block ({proposerRows[0].count.toLocaleString()}).
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                A bar chart of shares is more useful once more than one producer appears.
              </p>
            </div>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={proposerRows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={88}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--boing-navy-deep)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "var(--text-primary)" }}
                    formatter={(value: number | undefined) => [
                      `${(value ?? 0).toLocaleString()} block${(value ?? 0) === 1 ? "" : "s"}`,
                      "Produced",
                    ]}
                  />
                  <Bar dataKey="count" fill="var(--network-cyan)" radius={[0, 2, 2, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">BOING volume by flow</h4>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Bond + unbond + transfer amounts (window)</p>
          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-[var(--text-muted)]">Loading…</div>
          ) : volPieData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-center text-sm text-[var(--text-muted)]">
              No bond, unbond, or transfer volume in sampled blocks.
            </div>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={volPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {volPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="var(--boing-navy-deep)" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--boing-navy-deep)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "var(--text-primary)" }}
                    formatter={(_value: number | undefined, name: string | undefined, item) => {
                      const raw = (item?.payload as VolPieRow | undefined)?.raw;
                      const amt = raw != null ? formatBoingAmount(raw.toString()) : "—";
                      return [`${amt} BOING`, name ?? ""];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-4">
        <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">Cumulative BOING transferred</h4>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Running sum of Transfer amounts in this window (faucet and user sends)
        </p>
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
                    return [`${formatBoingAmount(String(Math.round(v)))} BOING`, "Cumulative transfers"];
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

      <aside className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-xs text-[var(--text-muted)]">
        <strong className="text-[var(--text-secondary)]">TVL &amp; APY:</strong> Network-wide staked supply and reward
        rate are not on this RPC. See the <strong className="text-[var(--text-secondary)]">Chain tip &amp; supply context</strong>{" "}
        section for circulation / total supply, and use account lookup for per-address stake.
      </aside>
    </div>
  );
}
