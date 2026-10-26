import { test, expect, type Page, type Route } from "@playwright/test";
import { installMinimalRpcMocks } from "./fixtures/rpc-mock";

/**
 * Enforcing nonce CSP (src/middleware.ts + src/lib/csp.ts). Runs against `next start`, i.e. the default mode
 * (`BOING_OBSERVER_CSP` unset = nonce-enforce). Every page is rendered per request so Next can stamp its inline
 * bootstrap scripts with the request nonce; a page that loses its nonce would not hydrate.
 */
const ROUTES = ["/", "/about", "/tokens", "/faucet", "/qa", "/dex/pools", "/tools/account-proof", "/tools/node-health", "/block/1"];

function inlineScriptTags(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]).filter((t) => !/application\/ld\+json/i.test(t));
}

test.describe("CSP headers and nonces", () => {
  for (const path of ROUTES) {
    test(`enforcing policy, nonce on every script: ${path}`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const h = res.headers();
      const csp = h["content-security-policy"];
      expect(csp, "enforcing header present").toBeTruthy();
      expect(h["content-security-policy-report-only"]).toBeUndefined();
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
      const nonce = /'nonce-([^']+)'/.exec(csp)![1];
      const tags = inlineScriptTags(await res.text());
      expect(tags.length).toBeGreaterThan(0);
      for (const t of tags) expect(t, t).toContain(`nonce="${nonce}"`);
      expect(h["cache-control"] ?? "").not.toMatch(/s-maxage|immutable/);
    });
  }

  test("nonce is fresh per request", async ({ request }) => {
    const a = (await request.get("/about")).headers()["content-security-policy"];
    const b = (await request.get("/about")).headers()["content-security-policy"];
    expect(/'nonce-([^']+)'/.exec(a)![1]).not.toBe(/'nonce-([^']+)'/.exec(b)![1]);
  });

  test("API responses get only the static baseline, not the page policy", async ({ request }) => {
    const res = await request.get("/api/csp-report");
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp).not.toMatch(/script-src|nonce-/);
  });
});

async function watchViolations(page: Page) {
  const consoleCsp: string[] = [];
  page.on("console", (m) => {
    if (/content security policy|refused to (execute|load|connect|apply)/i.test(m.text())) consoleCsp.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return {
    violations: async () => (await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)) ?? [],
    consoleCsp,
  };
}

test.describe("no CSP violations in the browser", () => {
  for (const path of ROUTES) {
    test(`hydrates cleanly: ${path}`, async ({ page }) => {
      await installMinimalRpcMocks(page);
      const w = await watchViolations(page);
      await page.goto(path);
      await expect(page.locator("#main-content")).toBeVisible();
      // Hydration proof: the mobile/desktop header search is interactive only after React attaches handlers.
      await page.waitForLoadState("networkidle");
      expect(await w.violations()).toEqual([]);
      expect(w.consoleCsp).toEqual([]);
    });
  }

  test("client navigation (needs hydrated scripts + RSC fetch) works", async ({ page }) => {
    await installMinimalRpcMocks(page);
    const w = await watchViolations(page);
    await page.goto("/");
    await page.locator("#main-content").getByTestId("explorer-search-input").fill("1");
    await page.locator("#main-content").getByTestId("explorer-search-submit").click();
    await expect(page).toHaveURL(/\/block\/1(\?|$)/);
    expect(await w.violations()).toEqual([]);
  });

  test("https images and media from NFT gateways are allowed; inline handlers are blocked", async ({ page }) => {
    await installMinimalRpcMocks(page);
    const w = await watchViolations(page);
    await page.route("https://gateway.example.test/**", (r: Route) =>
      r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgo=", "base64") }),
    );
    await page.goto("/about");
    await page.evaluate(() => {
      const img = new Image();
      img.src = "https://gateway.example.test/nft.png";
      document.body.appendChild(img);
      const v = document.createElement("video");
      v.src = "https://gateway.example.test/nft.mp4";
      document.body.appendChild(v);
    });
    await page.waitForTimeout(300);
    expect(await w.violations()).toEqual([]);

    // Enforcement is real: an inline event handler injected into the DOM must not run.
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.innerHTML = '<img src="data:," onerror="window.__pwned=1">';
      document.body.appendChild(d);
    });
    await expect.poll(async () => (await w.violations()).some((v) => v.startsWith("script-src"))).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect((await w.violations()).some((v) => v.startsWith("script-src"))).toBe(true);
  });
});

test.describe("node protocol parameters from boing_getNetworkInfo", () => {
  const unknownTx = "ab".repeat(32);

  async function mockNode(page: Page, netInfo: Record<string, unknown>, head = 5_000_000) {
    await installMinimalRpcMocks(page);
    await page.route("**/api/rpc", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      const body = JSON.parse(route.request().postData() ?? "{}") as { id?: number; method?: string };
      const reply = (result: unknown) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 0, result }) });
      if (body.method === "boing_getNetworkInfo") return reply({ head_height: head, end_user: {}, ...netInfo });
      if (body.method === "boing_chainHeight") return reply(head);
      if (body.method === "boing_getTransactionReceipt") return reply(null);
      return route.continue();
    });
  }

  test("pruned-receipt message uses the node's receipt_retention_blocks", async ({ page }) => {
    await mockNode(page, { receipt_retention_blocks: 250_000 });
    await page.goto(`/tx/${unknownTx}`);
    const detail = page.getByTestId("missing-receipt-detail");
    await expect(detail).toContainText("this node reports keeping receipts for the newest 250,000 blocks");
    await expect(detail).toContainText("#4750000");
  });

  test("an explicit null (unbounded retention) never suggests pruning", async ({ page }) => {
    await mockNode(page, { receipt_retention_blocks: null });
    await page.goto(`/tx/${unknownTx}`);
    const detail = page.getByTestId("missing-receipt-detail");
    await expect(detail).toContainText("keeps every receipt");
    await expect(detail).not.toContainText("pruned");
  });

  test("older nodes (fields absent) fall back to the default window wording", async ({ page }) => {
    await mockNode(page, {});
    await page.goto(`/tx/${unknownTx}`);
    await expect(page.getByTestId("missing-receipt-detail")).toContainText("the node default");
  });
});