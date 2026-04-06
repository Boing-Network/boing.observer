import { test, expect } from "@playwright/test";

test.describe("Boing Observer smoke", () => {
  test("home loads with explorer search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Boing Observer/i })).toBeVisible();
    await expect(page.locator("#main-content").getByTestId("explorer-search-input")).toBeVisible();
  });

  test("search by block height navigates", async ({ page }) => {
    await page.goto("/");
    await page.locator("#main-content").getByTestId("explorer-search-input").fill("1");
    await page.locator("#main-content").getByTestId("explorer-search-submit").click();
    await expect(page).toHaveURL(/\/block\/1(\?|$)/);
  });

  test("RPC method catalog page renders", async ({ page }) => {
    await page.goto("/tools/rpc-catalog");
    await expect(page.getByRole("heading", { name: /RPC method catalog/i })).toBeVisible();
  });

  test("DEX directory page renders", async ({ page }) => {
    await page.goto("/dex/pools");
    await expect(page.getByRole("heading", { name: /Native DEX directory/i })).toBeVisible();
  });

  test("About page renders", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /About Boing Network/i })).toBeVisible();
  });

  test("Tools index lists utilities", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { name: /Developer tools/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Node health & sync" })).toBeVisible();
  });

  test("Node health page renders", async ({ page }) => {
    await page.goto("/tools/node-health");
    await expect(page.getByRole("heading", { name: /Node health & sync/i })).toBeVisible();
  });

  test("mobile menu reaches Tools", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog", { name: "Site navigation and search" }).getByRole("link", { name: "Tools" }).click();
    await expect(page).toHaveURL(/\/tools$/);
  });
});
