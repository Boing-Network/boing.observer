/**
 * Native BOING denomination: 18 decimals, 1 BOING = 10^18 base units (boing.network
 * `docs/NATIVE-DENOMINATION.md`). Nodes return native amounts in ledger units: base units on chains that
 * start in base units (mainnet) and on public testnet 6913 from block 1050; blocks and state below that
 * height carry whole BOING. The explorer converts everything to base units first (`toBaseUnits`) so
 * amounts from either side of the switch can be added, charted and formatted the same way.
 */
import { compactAmount, type CompactAmount } from "./format-amount";

export const BOING_DECIMALS = 18;
export const BASE_UNITS_PER_BOING = BigInt("1000000000000000000");
/** Fee per gas in base units (0.000001 BOING; a 21,000-gas transfer costs 0.021 BOING). */
export const GAS_PRICE_BASE_UNITS = BigInt("1000000000000");
/** Public testnet 6913 switched native amounts from whole BOING to base units at this block. */
export const TESTNET_BASE_UNITS_FROM_HEIGHT = 1050;

/** First height whose native amounts are in base units (`native_currency.base_units_from_height`). */
export function baseUnitsFromHeight(network?: string | null): number {
  return network === "mainnet" ? 0 : TESTNET_BASE_UNITS_FROM_HEIGHT;
}

/**
 * Ledger decimals of amounts committed at `height`: 0 (whole BOING) below the switch, 18 from it.
 * Unknown height means current state, which is in base units.
 */
export function nativeDecimalsAt(height: number | null | undefined, network?: string | null): 0 | 18 {
  if (height == null || !Number.isFinite(height)) return 18;
  return height >= baseUnitsFromHeight(network) ? 18 : 0;
}

function toBigInt(raw: unknown): bigint | null {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? BigInt(raw) : null;
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/** Ledger amount with `decimals` (0 or 18) → base units. Null for non-integers. */
export function ledgerToBaseUnits(raw: unknown, decimals: number): bigint | null {
  const v = toBigInt(raw);
  if (v == null) return null;
  return decimals >= BOING_DECIMALS ? v : v * BASE_UNITS_PER_BOING;
}

/** Ledger amount committed at `height` → base units. */
export function toBaseUnits(raw: unknown, height: number | null | undefined, network?: string | null): bigint | null {
  return ledgerToBaseUnits(raw, nativeDecimalsAt(height, network));
}

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Exact BOING string for a base-unit amount (grouped whole part, trailing zeros trimmed). */
export function formatBoingBase(base: bigint | string | null | undefined, maxFractionDigits = BOING_DECIMALS): string {
  const v = toBigInt(base);
  if (v == null) return String(base ?? "—");
  const whole = v / BASE_UNITS_PER_BOING;
  const frac = (v % BASE_UNITS_PER_BOING)
    .toString()
    .padStart(BOING_DECIMALS, "0")
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  const w = groupDigits(whole.toString());
  if (!frac && v > BigInt(0) && whole === BigInt(0)) return `<0.${"0".repeat(Math.max(0, maxFractionDigits - 1))}1`;
  return frac ? `${w}.${frac}` : w;
}

/**
 * Compact BOING for cards (`short`) with the exact value for tooltips (`full`, no unit). Whole parts above
 * six digits use K/M/B/T like {@link compactAmount}; smaller amounts keep up to 4 fractional digits.
 */
export function compactBoing(base: bigint | string | null | undefined): CompactAmount {
  const v = toBigInt(base);
  if (v == null) {
    const s = String(base ?? "—");
    return { short: s, full: s };
  }
  const full = formatBoingBase(v);
  const whole = v / BASE_UNITS_PER_BOING;
  if (whole.toString().length > 6) return { short: compactAmount(whole).short, full };
  return { short: formatBoingBase(v, 4), full };
}

/** Exact BOING string for a ledger amount committed at `height`. */
export function formatBoingAt(raw: unknown, height: number | null | undefined, network?: string | null): string {
  const b = toBaseUnits(raw, height, network);
  return b == null ? String(raw ?? "—") : formatBoingBase(b);
}

/** Compact BOING for a ledger amount committed at `height`. */
export function compactBoingAt(raw: unknown, height: number | null | undefined, network?: string | null): CompactAmount {
  const b = toBaseUnits(raw, height, network);
  if (b == null) {
    const s = String(raw ?? "—");
    return { short: s, full: s };
  }
  return compactBoing(b);
}

/** Base units → BOING as a float for charts (precision loss is fine there). */
export function baseUnitsToChartNumber(base: bigint): number {
  if (base === BigInt(0)) return 0;
  const micro = base / BigInt("1000000000000"); // 10^-6 BOING
  return Number(micro) / 1e6;
}

/** Network fee in base units for `gasUsed` under the rule at `height` (whole-BOING era: ceil(gas/21000) BOING). */
export function feeBaseUnitsForGas(gasUsed: number | bigint, height: number | null | undefined, network?: string | null): bigint {
  const g = BigInt(gasUsed);
  if (g <= BigInt(0)) return BigInt(0);
  if (nativeDecimalsAt(height, network) === 18) return g * GAS_PRICE_BASE_UNITS;
  const whole = (g + BigInt(20999)) / BigInt(21000);
  return whole * BASE_UNITS_PER_BOING;
}
