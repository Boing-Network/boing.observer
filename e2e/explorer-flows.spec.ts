import { test, expect } from "@playwright/test";
import { installMinimalRpcMocks } from "./fixtures/rpc-mock";

/** Deterministic testnet faucet account; see `src/lib/testnet-constants.ts`. */
const TESTNET_FAUCET_ACCOUNT_HEX =
  "1e1a11f9eb8612aee66bdf0286dbb29ca662cadf7d76e384ac19449d62433615";

test.describe("Explorer account & transaction flows", () => {
  test("invalid transaction id shows validation error", async ({ page }) => {
    await page.goto("/tx/not-valid-hex");
    await expect(
      page.locator('[role="alert"]').filter({ hasText: /Invalid transaction id/i }),
    ).toBeVisible();
  });

  test("well-formed unknown transaction id shows no receipt", async ({ page }) => {
    await installMinimalRpcMocks(page);
    const unknown64 = "f".repeat(64);
    await page.goto(`/tx/${unknown64}`);
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/No receipt for this id/i)).toBeVisible();
  });

  test("invalid address shows validation error on account route", async ({ page }) => {
    await page.goto("/account/0xdeadbeef");
    await expect(page.locator('[role="alert"]').filter({ hasText: /Invalid address/i })).toBeVisible();
  });

  test("invalid address shows validation error on asset route", async ({ page }) => {
    await page.goto("/asset/0xdeadbeef");
    await expect(page.locator('[role="alert"]').filter({ hasText: /Invalid address/i })).toBeVisible();
  });

  test("testnet faucet account page loads contract hints section", async ({ page }) => {
    await installMinimalRpcMocks(page);
    await page.goto(`/account/${TESTNET_FAUCET_ACCOUNT_HEX}`);
    await expect(page.getByRole("heading", { name: /^Account$/i })).toBeVisible();
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Contract & network hints/i })).toBeVisible();
    await expect(page.getByText(/Indexer & bytecode scope/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Transaction history/i })).toBeVisible();
  });

  test("asset page loads same on-chain view for a valid address", async ({ page }) => {
    await installMinimalRpcMocks(page);
    await page.goto(`/asset/${TESTNET_FAUCET_ACCOUNT_HEX}`);
    await expect(page.getByRole("heading", { name: /^Asset$/i })).toBeVisible();
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Contract & network hints/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Transaction history/i })).toHaveCount(0);
  });
});
