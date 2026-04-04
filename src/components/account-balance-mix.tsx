"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBoingAmount } from "@/lib/tx-payload";
import { bigIntToChartNumber } from "@/lib/block-economics";

function parseU128(raw: string): bigint {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return BigInt(0);
  try {
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

type Slice = { name: "Liquid" | "Staked"; value: number; amountStr: string };

const FILL: Record<Slice["name"], string> = {
  Liquid: "var(--network-cyan)",
  Staked: "var(--network-primary-light)",
};

export function AccountBalanceMix({ balance, stake }: { balance: string; stake: string }) {
  const liq = parseU128(balance);
  const st = parseU128(stake);
  const total = liq + st;
  if (total === BigInt(0)) return null;

  const data: Slice[] = [];
  if (liq > BigInt(0)) {
    data.push({ name: "Liquid", value: bigIntToChartNumber(liq), amountStr: liq.toString() });
  }
  if (st > BigInt(0)) {
    data.push({ name: "Staked", value: bigIntToChartNumber(st), amountStr: st.toString() });
  }

  if (data.length === 0) return null;

  const basis = BigInt(10000);
  const stakedPct =
    total > BigInt(0) ? Number((st * basis) / total) / 100 : 0;

  return (
    <div className="glass-card flex flex-col p-4 sm:p-5" aria-labelledby="balance-mix-heading">
      <h3 id="balance-mix-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Balance mix
      </h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Liquid vs staked BOING (on-chain units).</p>
      <p className="mt-2 font-mono text-sm text-network-primary-light">{stakedPct.toFixed(1)}% staked</p>
      <div className="mt-2 h-[200px] w-full min-w-0 sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={FILL[entry.name]}
                  stroke="var(--boing-navy-deep)"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as Slice | undefined;
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-[var(--border-color)] bg-boing-navy-deep px-3 py-2 text-sm shadow-lg">
                    <p className="font-medium text-[var(--text-primary)]">{p.name}</p>
                    <p className="font-mono text-network-cyan">{formatBoingAmount(p.amountStr)} BOING</p>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-[var(--text-secondary)]">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
