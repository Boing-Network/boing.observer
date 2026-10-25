/**
 * App-level rate limiting for `/api/*`, designed for Cloudflare Workers (OpenNext) but dependency-free.
 *
 * Layers (both must allow a request):
 *  1. Optional Workers Rate Limiting binding named `API_RATE_LIMITER` (see wrangler.toml, commented sample).
 *     Counts are shared across isolates/colos per key, so this is the authoritative limiter when configured.
 *  2. In-memory fixed-window counters, per isolate. Best-effort only: each isolate counts on its own and
 *     state is lost on eviction, so the effective global limit is looser than configured. Still blunts
 *     naive loops and scrapers hitting a single isolate, and bounds work per client with no extra infra.
 *
 * Pure functions + a small class so it is unit-testable without Workers.
 */

export type RateLimitRule = {
  /** Stable bucket name (used in the key and in logs/headers). */
  name: string;
  /** Max requests per window per client. */
  limit: number;
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets (always >= 1 when denied). */
  retryAfterSec: number;
};

const MIN = 60;

/** Defaults (per client, per minute). Tunable with BOING_OBSERVER_RATE_LIMIT_SCALE. */
const RULES = {
  rpc: { name: "rpc", limit: 240, windowSec: MIN },
  heavy: { name: "heavy", limit: 60, windowSec: MIN },
  vote: { name: "vote", limit: 10, windowSec: MIN },
  report: { name: "report", limit: 20, windowSec: MIN },
  default: { name: "api", limit: 120, windowSec: MIN },
} as const satisfies Record<string, RateLimitRule>;

/** Routes that fan out to several upstream RPC calls or off-chain fetches per request. */
const HEAVY_PREFIXES = [
  "/api/account/history",
  "/api/account/nfts",
  "/api/asset/profile",
  "/api/asset/metadata",
  "/api/asset/nft",
  "/api/asset/companions",
  "/api/tokens/index",
  "/api/contract/interface",
  "/api/dex/",
  "/api/blob/",
];

/** Returns the rule for an `/api/*` path, or null when the path is not rate limited. */
export function ruleForPath(pathname: string, scale = 1): RateLimitRule | null {
  if (!pathname.startsWith("/api/")) return null;
  let base: RateLimitRule = RULES.default;
  if (pathname === "/api/rpc") base = RULES.rpc;
  else if (pathname === "/api/qa/vote") base = RULES.vote;
  else if (pathname === "/api/csp-report") base = RULES.report;
  else if (HEAVY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) {
    base = RULES.heavy;
  }
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return { ...base, limit: Math.max(1, Math.floor(base.limit * s)) };
}

/** Best-effort client identity. Cloudflare sets cf-connecting-ip; it cannot be spoofed at the edge. */
export function clientKey(headers: { get(name: string): string | null }): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown";
}

type Entry = { count: number; resetAt: number };

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxEntries = 5000) {}

  check(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
    const k = `${rule.name}:${key}`;
    let e = this.entries.get(k);
    if (!e || e.resetAt <= now) {
      this.prune(now);
      e = { count: 0, resetAt: now + rule.windowSec * 1000 };
      this.entries.set(k, e);
    }
    e.count += 1;
    const retryAfterSec = Math.max(1, Math.ceil((e.resetAt - now) / 1000));
    const allowed = e.count <= rule.limit;
    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - e.count),
      retryAfterSec,
    };
  }

  private prune(now: number) {
    if (this.entries.size < this.maxEntries) return;
    for (const [k, v] of this.entries) {
      if (v.resetAt <= now) this.entries.delete(k);
    }
    // Still full (attack with many distinct keys): drop oldest insertions so memory stays bounded.
    if (this.entries.size >= this.maxEntries) {
      const drop = Math.ceil(this.maxEntries / 10);
      let i = 0;
      for (const k of this.entries.keys()) {
        this.entries.delete(k);
        if (++i >= drop) break;
      }
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

type BindingLimiter = { limit(opts: { key: string }): Promise<{ success: boolean }> };

/** Reads the Workers Rate Limiting binding without importing the OpenNext runtime (keeps middleware edge-safe). */
export function getBindingLimiter(): BindingLimiter | null {
  const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: Record<string, unknown> }
    | undefined;
  const b = ctx?.env?.API_RATE_LIMITER as BindingLimiter | undefined;
  return b && typeof b.limit === "function" ? b : null;
}

const shared = new InMemoryRateLimiter();

export type RateLimitConfig = {
  enabled: boolean;
  scale: number;
};

export function rateLimitConfigFromEnv(env: Record<string, string | undefined>): RateLimitConfig {
  const mode = (env.BOING_OBSERVER_RATE_LIMIT ?? "on").trim().toLowerCase();
  const scale = Number(env.BOING_OBSERVER_RATE_LIMIT_SCALE ?? "1");
  return { enabled: mode !== "off" && mode !== "0" && mode !== "false", scale: Number.isFinite(scale) && scale > 0 ? scale : 1 };
}

/**
 * Applies the limiter for one request. Returns null if the path is not limited or limiting is disabled.
 * `limiter` / `binding` are injectable for tests.
 */
export async function applyRateLimit(
  pathname: string,
  headers: { get(name: string): string | null },
  cfg: RateLimitConfig,
  opts: { limiter?: InMemoryRateLimiter; binding?: BindingLimiter | null; now?: number } = {}
): Promise<(RateLimitResult & { rule: RateLimitRule }) | null> {
  if (!cfg.enabled) return null;
  const rule = ruleForPath(pathname, cfg.scale);
  if (!rule) return null;
  const key = clientKey(headers);
  const result = (opts.limiter ?? shared).check(key, rule, opts.now);
  if (result.allowed) {
    const binding = opts.binding === undefined ? getBindingLimiter() : opts.binding;
    if (binding) {
      try {
        const r = await binding.limit({ key: `${rule.name}:${key}` });
        if (!r.success) {
          return { ...result, allowed: false, remaining: 0, retryAfterSec: rule.windowSec, rule };
        }
      } catch {
        // Binding failure must never take the API down; the in-memory layer already allowed it.
      }
    }
  }
  return { ...result, rule };
}