"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HOME_BLOCK_WINDOW, useHomeChainData } from "@/context/home-chain-data";
import {
  analyzeBlockEconomics,
  blockIntervalSeries,
  formatIntervalLabel,
  intervalAxisScale,
} from "@/lib/block-economics";
import { blockValueSeries, blockValueTooltip, compactBoingAxis, type BlockValuePoint } from "@/lib/chart-native";

export function NetworkCharts() {
  const { sliceBlocks, loading, error } = useHomeChainData();
  const blocks = sliceBlocks(HOME_BLOCK_WINDOW);

  const { rows } = useMemo(() => analyzeBlockEconomics(blocks), [blocks]);

  const intervalRaw = useMemo(() => blockIntervalSeries(rows), [rows]);
  const maxInterval = intervalRaw.reduce((m, p) => Math.max(m, p.intervalSec), 0);
  const axis = intervalAxisScale(maxInterval);
  const intervalData = useMemo(
    () =>
      intervalRaw.map((p) => ({
        height: p.height,
        interval: p.intervalSec / axis.divisor,
        intervalSec: p.intervalSec,
      })),
    [intervalRaw, axis.divisor]
  );

  const valueData = useMemo(() => blockValueSeries(rows), [rows]);

  const anyValue = valueData.some((d) => d.transfer > 0 || d.bond > 0 || d.unbond > 0);

  if (error && rows.length === 0 && !loading) {
    return (
      <div className="py-2" role="region" aria-label="Network charts">
        <div className="glass-card border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" role="region" aria-labelledby="charts-region-heading">
      <div>
        <h3
          id="charts-region-heading"
          className="font-display text-base font-semibold text-[var(--text-primary)]"
        >
          Liveness and value
        </h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-muted)]">
          Testnet blocks often carry a single transaction, so tx-per-block is not a useful signal.
          Interval shows idle gaps between produced blocks; BOING moved is payload amounts, not
          transaction count.
        </p>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center p-8 text-[var(--text-muted)]">
          Loading charts…
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-8 text-center text-[var(--text-muted)]">No block data available yet.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-4">
            <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">
              Time between blocks ({axis.unit})
            </h4>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Consecutive heights in the last {rows.length} blocks
            </p>
            <div className="h-[200px]">
              {intervalData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                  Need at least two timestamps.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={intervalData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                    <XAxis
                      dataKey="height"
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickFormatter={(v) => `${Number(v).toFixed(axis.unit === "s" ? 0 : 1)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--boing-navy-deep)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "var(--text-primary)" }}
                      formatter={(value: number | undefined, _n, item) => {
                        const sec = (item?.payload as { intervalSec?: number } | undefined)?.intervalSec;
                        return [sec != null ? formatIntervalLabel(sec) : String(value ?? "—"), "Interval"];
                      }}
                      labelFormatter={(label) => `Block #${Number(label).toLocaleString()}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="interval"
                      stroke="var(--network-cyan)"
                      strokeWidth={2}
                      dot={{ fill: "var(--network-cyan)", r: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass-card p-4">
            <h4 className="mb-1 text-sm font-medium text-[var(--text-muted)]">BOING moved per block</h4>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Transfer, bond, and unbond amounts (not how many txs)
            </p>
            <div className="h-[200px]">
              {!anyValue ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-[var(--text-muted)]">
                  No transfer or stake amounts in this window.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                    <XAxis
                      dataKey="height"
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickFormatter={(v) => Number(v).toLocaleString()}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickFormatter={compactBoingAxis}
                      width={44}
                      label={{ value: "BOING", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--boing-navy-deep)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "var(--text-primary)" }}
                      separator=": "
                      formatter={(_value, name, item) =>
                        blockValueTooltip(name, item?.payload as Partial<BlockValuePoint> | undefined)
                      }
                      labelFormatter={(label) => `Block #${Number(label).toLocaleString()}`}
                    />
                    <Bar dataKey="transfer" stackId="v" fill="var(--chart-transfer)" name="transfer" />
                    <Bar dataKey="bond" stackId="v" fill="var(--chart-bond)" name="bond" />
                    <Bar
                      dataKey="unbond"
                      stackId="v"
                      fill="var(--chart-unbond)"
                      name="unbond"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
