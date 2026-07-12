import "server-only";

import type { BoingClient } from "boing-sdk";
import { buildNativeDexIntegrationOverridesFromProcessEnv, fetchNativeDexIntegrationDefaults } from "boing-sdk";

const FACTORY_CACHE_TTL_MS = 10 * 60_000;

type CacheEntry = { expiresAt: number; value: string | null };

const factoryCache = new Map<string, CacheEntry>();

/**
 * Native DEX factory for explorer RPC calls — same merge order as boing-sdk
 * (`end_user` hints → embedded testnet constants when chain id matches → process env overrides).
 * Cached briefly; factory addresses rarely change mid-session.
 */
export async function resolveNativeDexFactoryForExplorer(client: BoingClient): Promise<string | null> {
  const cacheKey = client.getBaseUrl();
  const now = Date.now();
  const hit = factoryCache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.value;

  const ov = buildNativeDexIntegrationOverridesFromProcessEnv();
  const defaults = await fetchNativeDexIntegrationDefaults(client, Object.keys(ov).length ? ov : undefined);
  const value = defaults.nativeDexFactoryAccountHex;
  factoryCache.set(cacheKey, { expiresAt: now + FACTORY_CACHE_TTL_MS, value });
  return value;
}
