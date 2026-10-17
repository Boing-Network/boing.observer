/**
 * Chart helpers for native BOING amounts. Rows from `analyzeBlockEconomics` are already in base units
 * (normalized per block height: whole BOING below testnet 1050, base units from it); these turn them into
 * plot numbers (BOING as floats), compact axis labels and exact tooltip text.
 */
import type { BlockEconomicsRow } from "./block-economics";
import { baseUnitsToChartNumber, compactBoing } from "./native-unit";

export type BlockValuePoint = {
  height: number;
  transfer: number;
  bond: number;
  unbond: number;
  transferRaw: bigint;
  bondRaw: bigint;
  unbondRaw: bigint;
};

/** Per-block BOING moved (transfer / bond / unbond) for the stacked bar chart. */
export function blockValueSeries(rows: BlockEconomicsRow[]): BlockValuePoint[] {
  return rows.map((r) => ({
    height: r.height,
    transfer: baseUnitsToChartNumber(r.transferVolume),
    bond: baseUnitsToChartNumber(r.bond),
    unbond: baseUnitsToChartNumber(r.unbond),
    transferRaw: r.transferVolume,
    bondRaw: r.bond,
    unbondRaw: r.unbond,
  }));
}

const AXIS_SUFFIX: Array<[number, string]> = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Compact BOING axis tick: `0`, `0.5`, `20`, `1.5K`, `2M` (plot values are BOING). */
export function compactBoingAxis(v: number | string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const a = Math.abs(n);
  for (const [d, s] of AXIS_SUFFIX) {
    if (a >= d) return `${trimNum(n / d)}${s}`;
  }
  if (a < 0.01) return n.toExponential(0);
  return trimNum(n);
}

function trimNum(n: number): string {
  const s = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
  return s.replace(/\.?0+$/, "");
}

const SERIES_LABEL: Record<string, string> = { transfer: "Transfer", bond: "Bond", unbond: "Unbond" };

/** Tooltip entry for the per-block chart: `["20 BOING", "Transfer"]` from the exact base-unit amount. */
export function blockValueTooltip(name: unknown, payload: Partial<BlockValuePoint> | undefined): [string, string] {
  const key = String(name ?? "");
  const raw = key === "transfer" ? payload?.transferRaw : key === "bond" ? payload?.bondRaw : payload?.unbondRaw;
  const label = SERIES_LABEL[key] ?? key;
  return [raw != null ? `${compactBoing(raw).short} BOING` : "—", label];
}

/** Tooltip for base-unit amounts (exact, compacted above 6 whole digits). */
export function boingTooltipValue(raw: bigint | null | undefined): string {
  return raw != null ? `${compactBoing(raw).short} BOING` : "—";
}
