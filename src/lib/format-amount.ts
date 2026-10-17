/**
 * Compact display of integer BOING amounts (u128 strings). Cards and narratives show `short`; the exact
 * value goes in a tooltip (`full`). Never use `short` where the exact amount matters (payload fields).
 */

const SUFFIXES = ["", "K", "M", "B", "T"] as const;

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export type CompactAmount = { short: string; full: string };

/**
 * - up to 6 digits: grouped (`999,999`)
 * - up to 15 digits: one decimal + K/M/B/T (`1.2M`, `3.4T`)
 * - larger: scientific (`1.0e30`)
 * Non-integer input is returned as-is.
 */
export function compactAmount(raw: string | bigint | number): CompactAmount {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return { short: s, full: s };
  const digits = s.replace(/^0+(?=\d)/, "");
  const full = groupDigits(digits);
  const n = digits.length;
  if (n <= 6) return { short: full, full };
  if (n <= 15) {
    const k = Math.floor((n - 1) / 3); // 2 = M ... 4 = T
    const intLen = n - k * 3;
    const intPart = digits.slice(0, intLen);
    const dec = digits[intLen];
    return { short: `${intPart}${dec !== "0" ? `.${dec}` : ""}${SUFFIXES[k]}`, full };
  }
  return { short: `${digits[0]}.${digits[1]}e${n - 1}`, full };
}

/** `short` + " BOING". */
export function formatBoingCompact(raw: string | bigint | number): string {
  return `${compactAmount(raw).short} BOING`;
}

/**
 * Token decimals label for DEX directory rows. Nodes report `0` for reference fungible tokens (v2 etc.,
 * whole units) and `null` when they cannot tell; show "Unknown" rather than guessing 18.
 */
export function formatTokenDecimals(decimals: number | null | undefined, opts: { short?: boolean } = {}): string {
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0) return opts.short ? "?" : "Unknown";
  return decimals === 0 && !opts.short ? "0 (whole units)" : String(decimals);
}
