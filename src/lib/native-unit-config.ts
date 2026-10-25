/**
 * Live native-unit configuration: where the whole-BOING -> base-unit switch happened and what the fee
 * schedule is. Source of truth is the node (`boing_getNetworkInfo.native_currency` and
 * `boing_getNetworkFeePolicy`). The constants below are only the fallback used before the first live
 * response and for nodes that do not report these fields.
 *
 * The config is a small per-network registry so the pure formatting helpers in `native-unit.ts` stay
 * synchronous. React code subscribes through `useNativeUnitConfig` (src/hooks).
 */
import type { BoingNetworkFeePolicy, BoingNetworkInfo } from "./rpc-types";

/** Fee per gas in base units at the **full** historical schedule (0.000001 BOING/gas). */
export const DEFAULT_GAS_PRICE_BASE_UNITS = BigInt("1000000000000");
/** Recommended micro fee: 1% of the historical schedule (~0.00021 BOING per 21,000-gas transfer). */
export const DEFAULT_EXECUTION_GAS_FEE_BPS = 100;
/** Public testnet 6913 switched native amounts from whole BOING to base units at this block. */
export const DEFAULT_TESTNET_BASE_UNITS_FROM_HEIGHT = 1050;

export type NativeUnitConfigSource = "live" | "fallback";

export interface NativeUnitConfig {
  /** First height whose native amounts are in base units (0 = base units from genesis). */
  baseUnitsFromHeight: number;
  gasPriceBaseUnits: bigint;
  /** Execution gas fee as bps of the full schedule (10_000 = full, 0 = waived). */
  executionGasFeeBps: number;
  /** Flat fee added to every tx (base units). */
  extraFixedFee: bigint;
  source: NativeUnitConfigSource;
}

export function fallbackNativeUnitConfig(network?: string | null): NativeUnitConfig {
  return {
    baseUnitsFromHeight: network === "mainnet" ? 0 : DEFAULT_TESTNET_BASE_UNITS_FROM_HEIGHT,
    gasPriceBaseUnits: DEFAULT_GAS_PRICE_BASE_UNITS,
    executionGasFeeBps: DEFAULT_EXECUTION_GAS_FEE_BPS,
    extraFixedFee: BigInt(0),
    source: "fallback",
  };
}

function parseNonNegBigInt(raw: unknown): bigint | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? BigInt(raw) : null;
  if (typeof raw === "string" && /^\d{1,39}$/.test(raw.trim())) return BigInt(raw.trim());
  return null;
}

function parseBps(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? Math.min(10_000, Math.floor(raw)) : null;
}

/**
 * Merge whatever the node reported over the fallback. Missing or malformed fields keep their fallback value,
 * `source` is `"live"` only when at least one field came from the node.
 */
export function deriveNativeUnitConfig(
  network: string | null | undefined,
  info?: Pick<BoingNetworkInfo, "native_currency" | "treasury"> | null,
  policy?: BoingNetworkFeePolicy | null,
): NativeUnitConfig {
  const cfg = fallbackNativeUnitConfig(network);
  let live = false;

  const nc = info?.native_currency;
  if (nc && typeof nc === "object") {
    if (nc.base_units_from_height === null) {
      // `null` means "base units from genesis" in the spec.
      cfg.baseUnitsFromHeight = 0;
      live = true;
    } else if (typeof nc.base_units_from_height === "number" && Number.isSafeInteger(nc.base_units_from_height) && nc.base_units_from_height >= 0) {
      cfg.baseUnitsFromHeight = nc.base_units_from_height;
      live = true;
    }
    const gp = parseNonNegBigInt(nc.gas_price_base_units);
    if (gp != null && gp > BigInt(0)) {
      cfg.gasPriceBaseUnits = gp;
      live = true;
    }
  }

  const p = policy ?? info?.treasury?.fee_policy ?? null;
  if (p) {
    const bps = parseBps(p.execution_gas_fee_bps);
    if (bps != null) {
      cfg.executionGasFeeBps = bps;
      live = true;
    }
    const gp = parseNonNegBigInt(p.gas_price_base_units);
    if (gp != null && gp > BigInt(0)) cfg.gasPriceBaseUnits = gp;
    const fixed = parseNonNegBigInt(p.extra_fixed_fee);
    if (fixed != null) cfg.extraFixedFee = fixed;
  }

  cfg.source = live ? "live" : "fallback";
  return cfg;
}

const registry = new Map<string, NativeUnitConfig>();
const listeners = new Set<() => void>();

function key(network?: string | null): string {
  return network === "mainnet" ? "mainnet" : "testnet";
}

const stableFallbacks = new Map<string, NativeUnitConfig>();

/** Stable (referentially equal) fallback per network: required for `useSyncExternalStore` snapshots. */
export function getNativeUnitConfig(network?: string | null): NativeUnitConfig {
  const k = key(network);
  const live = registry.get(k);
  if (live) return live;
  let fb = stableFallbacks.get(k);
  if (!fb) {
    fb = Object.freeze(fallbackNativeUnitConfig(k)) as NativeUnitConfig;
    stableFallbacks.set(k, fb);
  }
  return fb;
}

export function setNativeUnitConfig(network: string | null | undefined, cfg: NativeUnitConfig): void {
  registry.set(key(network), cfg);
  for (const l of listeners) l();
}

/** Test helper / network teardown: drop every live value. */
export function resetNativeUnitConfig(): void {
  registry.clear();
  for (const l of listeners) l();
}

export function subscribeNativeUnitConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}