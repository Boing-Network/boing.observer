import { test, expect, type Page } from "@playwright/test";
import { installMinimalRpcMocks } from "./fixtures/rpc-mock";

/**
 * Wallet deep links (`/tx/<id>?network=…`, `/account/<addr>?network=…`) must fetch from the network the
 * link names, never first from the default. Mainnet is not configured in the e2e build
 * (`NEXT_PUBLIC_MAINNET_RPC` is inlined at build time), so the mainnet cases assert the graceful fallback;
 * the resolution rules themselves are unit-tested in `src/lib/network-param.test.ts`.
 */

const TX_ID = "f".repeat(64);
const ADDR = "1e1a11f9eb8612aee66bdf0286dbb29ca662cadf7d76e384ac19449d62433615";

/** Record the `X-Boing-RPC-Network` header of every proxied RPC call (after the shared mocks are installed). */
async function recordRpcNetworks(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.route("**/api/rpc", async (route) => {
    if (route.request().method() === "POST") {
      seen.push(route.request().headers()["x-boing-rpc-network"] ?? "(missing)");
    }
    await route.fallback();
  });
  return seen;
}

test.describe("?network deep links", () => {
  test("tx deep link with network=testnet fetches testnet only", async ({ page }) => {
    await installMinimalRpcMocks(page);
    const seen = await recordRpcNetworks(page);
    await page.goto(`/tx/${TX_ID}?network=testnet`);
    await expect(page.getByText(/No receipt for this id/i)).toBeVisible({ timeout: 20_000 });
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(["testnet"]));
    await expect(page.getByTestId("network-link-notice")).toHaveCount(0);
  });

  test("tx deep link to an unavailable mainnet falls back to testnet with a notice", async ({ page }) => {
    await installMinimalRpcMocks(page);
    const seen = await recordRpcNetworks(page);
    await page.goto(`/tx/${TX_ID}?network=mainnet`);
    await expect(page.getByTestId("network-link-notice")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("network-link-notice")).toContainText(/mainnet/i);
    await expect(page.getByText(/No receipt for this id/i)).toBeVisible({ timeout: 20_000 });
    expect(seen).not.toContain("mainnet");
    expect(new Set(seen)).toEqual(new Set(["testnet"]));
    expect(await page.evaluate(() => localStorage.getItem("boing-explorer-network"))).not.toBe("mainnet");
  });

  test("account deep link with network=testnet loads and fetches testnet only", async ({ page }) => {
    await installMinimalRpcMocks(page);
    const seen = await recordRpcNetworks(page);
    await page.goto(`/account/${ADDR}?network=testnet`);
    await expect(page.getByRole("heading", { name: /^Account$/i })).toBeVisible();
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(["testnet"]));
  });

  test("the URL network overrides a stored preference and is persisted", async ({ page }) => {
    await installMinimalRpcMocks(page);
    await page.addInitScript(() => localStorage.setItem("boing-explorer-network", "mainnet"));
    const seen = await recordRpcNetworks(page);
    await page.goto(`/tx/${TX_ID}?network=testnet`);
    await expect(page.getByText(/No receipt for this id/i)).toBeVisible({ timeout: 20_000 });
    expect(seen).not.toContain("mainnet");
    expect(await page.evaluate(() => localStorage.getItem("boing-explorer-network"))).toBe("testnet");
  });

  test("a stale stored mainnet preference is ignored when mainnet is not configured", async ({ page }) => {
    await installMinimalRpcMocks(page);
    await page.addInitScript(() => localStorage.setItem("boing-explorer-network", "mainnet"));
    const seen = await recordRpcNetworks(page);
    await page.goto(`/tx/${TX_ID}`);
    await expect(page.getByText(/No receipt for this id/i)).toBeVisible({ timeout: 20_000 });
    expect(seen).not.toContain("mainnet");
    await expect(page.getByTestId("network-link-notice")).toHaveCount(0);
  });
});