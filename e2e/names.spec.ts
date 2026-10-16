import { expect, test } from "@playwright/test";

/**
 * `.boing` names against the live testnet (dexdeployer.boing is registered there).
 * Opt-in: OBSERVER_NAMES_LIVE=1. Screenshots: NAMES_SHOTS=<dir> → after-14-observer-*.png.
 */
const LIVE = process.env.OBSERVER_NAMES_LIVE === "1";
const SHOTS = process.env.NAMES_SHOTS;
const DEPLOYER = "8079f30559c02c5fe087c9ad1bc3b751a29de35992f3f8431734243e825f696e";

test.describe("boing names (live testnet)", () => {
  test.skip(!LIVE, "set OBSERVER_NAMES_LIVE=1");
  test.use({ viewport: { width: 1280, height: 900 } });

  test("search by name opens /name/<label> with owner and target", async ({ page }) => {
    await page.goto("/?network=testnet");
    const input = page.getByTestId("explorer-search-input").first();
    await input.fill("DexDeployer.boing");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/name\/dexdeployer\?network=testnet/);
    await expect(page.getByTestId("name-title")).toHaveText("dexdeployer.boing");
    await expect(page.getByTestId("name-status")).toHaveText("active");
    await expect(page.getByTestId("name-target").locator("a").first()).toHaveAttribute("title", `0x${DEPLOYER}`);
    await expect(page.getByText("primary name", { exact: true })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-14-observer-name.png`, fullPage: true });
  });

  test("account page shows the primary name and owned names", async ({ page }) => {
    await page.goto(`/account/${DEPLOYER}?network=testnet`);
    await expect(page.getByTestId("boing-name-tag").first()).toHaveText("dexdeployer.boing", { timeout: 20_000 });
    await expect(page.getByTestId("account-names")).toContainText("dexdeployer.boing");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-14-observer-account.png`, fullPage: false });
  });

  test("unregistered name shows availability", async ({ page }) => {
    await page.goto("/name/zz-unclaimed-test?network=testnet");
    await expect(page.getByTestId("name-available")).toContainText("is available for 1 BOING / year");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-14-observer-available.png`, fullPage: true });
  });
});