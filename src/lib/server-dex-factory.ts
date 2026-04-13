import "server-only";

import type { NetworkInfo } from "boing-sdk";

/** Canonical native DEX factory from `boing_getNetworkInfo.end_user` when the node publishes it. */
export function canonicalNativeDexFactoryHex(info: NetworkInfo): string | null {
  const raw = info.end_user?.canonical_native_dex_factory;
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export function dexDiagnosticsEnabled(): boolean {
  return process.env.BOING_OBSERVER_ALLOW_DEX_DIAGNOSTICS === "1";
}
