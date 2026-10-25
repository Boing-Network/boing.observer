import { describe, expect, it } from "vitest";
import {
  InMemoryRateLimiter,
  applyRateLimit,
  clientKey,
  rateLimitConfigFromEnv,
  ruleForPath,
} from "./rate-limit";

const h = (o: Record<string, string>) => new Headers(o);

describe("ruleForPath", () => {
  it("ignores non-api paths", () => {
    expect(ruleForPath("/tx/abc")).toBeNull();
  });
  it("classifies routes", () => {
    expect(ruleForPath("/api/rpc")?.name).toBe("rpc");
    expect(ruleForPath("/api/account/history")?.name).toBe("heavy");
    expect(ruleForPath("/api/asset/profile")?.name).toBe("heavy");
    expect(ruleForPath("/api/tokens/index")?.name).toBe("heavy");
    expect(ruleForPath("/api/dex/quote")?.name).toBe("heavy");
    expect(ruleForPath("/api/qa/vote")?.name).toBe("vote");
    expect(ruleForPath("/api/qa/reviewer-status")?.name).toBe("api");
  });
  it("scales limits and clamps to >= 1", () => {
    expect(ruleForPath("/api/rpc", 2)?.limit).toBe(480);
    expect(ruleForPath("/api/qa/vote", 0.01)?.limit).toBe(1);
    expect(ruleForPath("/api/rpc", -3)?.limit).toBe(240);
  });
});

describe("clientKey", () => {
  it("prefers cf-connecting-ip, then x-real-ip, then first x-forwarded-for", () => {
    expect(clientKey(h({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientKey(h({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientKey(h({ "x-forwarded-for": "4.4.4.4, 5.5.5.5" }))).toBe("4.4.4.4");
    expect(clientKey(h({}))).toBe("unknown");
  });
});

describe("InMemoryRateLimiter", () => {
  const rule = { name: "t", limit: 3, windowSec: 10 };
  it("allows up to the limit then denies with retryAfter", () => {
    const l = new InMemoryRateLimiter();
    expect(l.check("a", rule, 0).allowed).toBe(true);
    expect(l.check("a", rule, 1000).allowed).toBe(true);
    const third = l.check("a", rule, 2000);
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
    const denied = l.check("a", rule, 3000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBe(7);
  });
  it("tracks clients independently and resets after the window", () => {
    const l = new InMemoryRateLimiter();
    for (let i = 0; i < 4; i++) l.check("a", rule, 0);
    expect(l.check("a", rule, 500).allowed).toBe(false);
    expect(l.check("b", rule, 500).allowed).toBe(true);
    expect(l.check("a", rule, 10_001).allowed).toBe(true);
  });
  it("keeps memory bounded under many distinct keys", () => {
    const l = new InMemoryRateLimiter(50);
    for (let i = 0; i < 500; i++) l.check(`k${i}`, rule, 0);
    expect(l.size).toBeLessThanOrEqual(50);
  });
});

describe("applyRateLimit", () => {
  const cfg = { enabled: true, scale: 1 };
  it("returns null when disabled or not an api path", async () => {
    expect(await applyRateLimit("/api/rpc", h({}), { enabled: false, scale: 1 })).toBeNull();
    expect(await applyRateLimit("/", h({}), cfg)).toBeNull();
  });
  it("denies the 11th vote from one client", async () => {
    const limiter = new InMemoryRateLimiter();
    const headers = h({ "cf-connecting-ip": "9.9.9.9" });
    let last;
    for (let i = 0; i < 11; i++) last = await applyRateLimit("/api/qa/vote", headers, cfg, { limiter, binding: null, now: 0 });
    expect(last?.allowed).toBe(false);
    expect(last?.rule.name).toBe("vote");
  });
  it("honours a denying binding and tolerates a throwing one", async () => {
    const limiter = new InMemoryRateLimiter();
    const deny = { limit: async () => ({ success: false }) };
    const r = await applyRateLimit("/api/rpc", h({}), cfg, { limiter, binding: deny });
    expect(r?.allowed).toBe(false);
    const boom = { limit: async () => { throw new Error("down"); } };
    const ok = await applyRateLimit("/api/rpc", h({}), cfg, { limiter: new InMemoryRateLimiter(), binding: boom });
    expect(ok?.allowed).toBe(true);
  });
});

describe("rateLimitConfigFromEnv", () => {
  it("defaults on, supports off and scale", () => {
    expect(rateLimitConfigFromEnv({})).toEqual({ enabled: true, scale: 1 });
    expect(rateLimitConfigFromEnv({ BOING_OBSERVER_RATE_LIMIT: "off" }).enabled).toBe(false);
    expect(rateLimitConfigFromEnv({ BOING_OBSERVER_RATE_LIMIT_SCALE: "3" }).scale).toBe(3);
    expect(rateLimitConfigFromEnv({ BOING_OBSERVER_RATE_LIMIT_SCALE: "abc" }).scale).toBe(1);
  });
});