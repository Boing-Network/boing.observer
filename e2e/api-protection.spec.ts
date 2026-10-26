import { test, expect } from "@playwright/test";

/** These hit the real Next server (no browser mocks): proxy validation happens before any upstream call. */
test.describe("/api/rpc proxy validation", () => {
  const H = { "content-type": "application/json", "x-boing-rpc-network": "testnet" };

  test("rejects a missing/invalid network header", async ({ request }) => {
    const res = await request.post("/api/rpc", {
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.1" },
      data: { jsonrpc: "2.0", id: 1, method: "boing_chainHeight", params: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects invalid JSON and batches", async ({ request }) => {
    const bad = await request.post("/api/rpc", { headers: { ...H, "x-forwarded-for": "198.51.100.2" }, data: "{nope" });
    expect(bad.status()).toBe(400);
    const batch = await request.post("/api/rpc", {
      headers: { ...H, "x-forwarded-for": "198.51.100.2" },
      data: [{ jsonrpc: "2.0", id: 1, method: "boing_chainHeight", params: [] }],
    });
    expect(batch.status()).toBe(400);
  });

  test("returns a JSON-RPC -32601 for methods outside the allow-list", async ({ request }) => {
    const res = await request.post("/api/rpc", {
      headers: { ...H, "x-forwarded-for": "198.51.100.3" },
      data: { jsonrpc: "2.0", id: 7, method: "boing_faucetRequest_not_allowed", params: [] },
    });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.id).toBe(7);
    expect(j.error.code).toBe(-32601);
  });

  test("rejects oversized request bodies", async ({ request }) => {
    const res = await request.post("/api/rpc", {
      headers: { ...H, "x-forwarded-for": "198.51.100.4" },
      data: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "boing_chainHeight", params: ["x".repeat(1_100_000)] }),
    });
    expect(res.status()).toBe(413);
  });
});

test.describe("app-level rate limiting", () => {
  test("returns 429 + Retry-After once a client exceeds the /api/qa/vote budget", async ({ request }) => {
    // Unique client key per run so repeated local runs inside the same minute stay independent.
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    const statuses: number[] = [];
    let last: Awaited<ReturnType<typeof request.get>> | undefined;
    for (let i = 0; i < 12; i++) {
      last = await request.get("/api/qa/vote", { headers: { "x-forwarded-for": ip } });
      statuses.push(last.status());
    }
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(last!.headers()["retry-after"]).toMatch(/^\d+$/);
    const body = await last!.json();
    expect(body.code).toBe("rate_limited");
  });

  test("clients are limited independently", async ({ request }) => {
    const a = `192.0.2.${Math.floor(Math.random() * 120) + 1}`;
    const b = `192.0.2.${Math.floor(Math.random() * 120) + 130}`;
    for (let i = 0; i < 12; i++) await request.get("/api/qa/vote", { headers: { "x-forwarded-for": a } });
    const other = await request.get("/api/qa/vote", { headers: { "x-forwarded-for": b } });
    expect(other.status()).not.toBe(429);
  });
});

test.describe("CSP + security headers", () => {
  test("pages carry an enforcing CSP and the static baseline", async ({ request }) => {
    const res = await request.get("/about");
    const h = res.headers();
    expect(h["content-security-policy-report-only"]).toBeUndefined();
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("report-uri /api/csp-report");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  test("csp-report sink accepts reports and rejects oversized ones", async ({ request }) => {
    const ok = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report", "x-forwarded-for": "198.51.100.50" },
      data: JSON.stringify({ "csp-report": { "violated-directive": "img-src" } }),
    });
    expect(ok.status()).toBe(204);
    const big = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report", "x-forwarded-for": "198.51.100.51" },
      data: "x".repeat(20_000),
    });
    expect(big.status()).toBe(413);
  });
});