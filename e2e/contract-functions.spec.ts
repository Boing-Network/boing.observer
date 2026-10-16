import { expect, test } from "@playwright/test";

/**
 * Contract pages list every function the contract can perform.
 * - Mocked test (always on): renders the interface API response.
 * - Live tests: OBSERVER_CONTRACTS_LIVE=1 (+ PLAYWRIGHT_BASE_URL=https://boing.observer). Screenshots: CONTRACT_SHOTS=<dir>.
 */
const LIVE = process.env.OBSERVER_CONTRACTS_LIVE === "1";
const SHOTS = process.env.CONTRACT_SHOTS;

const CONTRACTS = [
  { slug: "usdc-token", path: "asset", id: "6676f971ade3982406efa3e2cdb0477923f8f2a15624c4b6ad3a432817a75e93", label: /USDC/, fns: ["transfer", "mint_first", "approve", "transfer_from", "allowance"], selectors: 5 },
  { slug: "v9-pool", path: "account", id: "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61", label: /pool v9/, fns: ["swap", "swap_to", "add_liquidity", "remove_liquidity", "remove_liquidity_to", "set_tokens", "set_swap_fee_bps", "set_fee_admin"], selectors: 8 },
  { slug: "router", path: "account", id: "806b2462b28f2f5772bbf5ae2628ad3a333bd2c5fa341144e0400ef5c2f1e4c6", label: /Custody router/, fns: ["swap"], selectors: 1 },
  { slug: "lp-vault", path: "account", id: "236a851dd50faaa268e2e1b7ba95cfb9993773abf63a4c0d949183d8302e65c7", label: /LP vault v2/, fns: ["configure", "deposit", "withdraw", "transfer_shares"], selectors: 4 },
];

test.describe("contract functions (mocked API)", () => {
  test.skip(LIVE, "live run");
  test("unknown selectors and named functions render", async ({ page }) => {
    await page.route("**/api/contract/interface**", (route) =>
      route.fulfill({
        json: {
          address: "ab".repeat(32),
          source: "selectors",
          interfaceId: "fungible-v1",
          label: "Reference fungible token (v1) (closest match)",
          summary: "Boing reference token: balances, one-time mint, transfers.",
          docsUrl: null,
          functions: [
            { selector: 1, name: "transfer", params: [{ name: "to", type: "account" }, { name: "amount", type: "u128" }], kind: "write", description: "Move tokens.", access: "Anyone." },
          ],
          decodedSelectors: [1, 0x42],
          unknownSelectors: [0x42],
          code: { deployer: "cd".repeat(32), height: 12, txIndex: 0, sizeBytes: 321 },
          notes: [],
          calledAsContract: true,
          callCount: 3,
        },
      }),
    );
    await page.goto(`/account/${"ab".repeat(32)}?network=testnet`);
    const section = page.getByTestId("contract-functions");
    await expect(section).toBeVisible({ timeout: 20_000 });
    await expect(section.getByTestId("contract-fn-name")).toHaveText("transfer(to: account, amount: u128)");
    await expect(section.getByTestId("contract-unknown-selectors")).toContainText("0x42");
    await expect(section.getByTestId("contract-code-info")).toContainText("321 bytes");
    await expect(section.getByTestId("published-by-deployer-badge")).toHaveCount(0);
  });

  test("verified published interface shows the deployer badge", async ({ page }) => {
    await page.route("**/api/contract/interface**", (route) =>
      route.fulfill({
        json: {
          address: "ab".repeat(32),
          source: "published",
          interfaceId: null,
          label: "My published pool",
          summary: null,
          docsUrl: null,
          functions: [{ selector: 16, name: "swap", params: [], kind: "write", description: "Swap.", access: "Anyone." }],
          decodedSelectors: [16],
          unknownSelectors: [],
          code: { deployer: null, height: null, txIndex: null, codeHash: "ef".repeat(32), via: "rpc", sizeBytes: 99 },
          notes: [],
          calledAsContract: true,
          callCount: 1,
          published: { registry: "bd".repeat(32), claimer: "cd".repeat(32), publisher: "cd".repeat(32), interfaceHash: "aa".repeat(32), uri: "https://boing.network/interfaces/testnet/x.json", verified: true, deployerVerified: true, hashVerified: true },
        },
      }),
    );
    await page.goto(`/account/${"ab".repeat(32)}?network=testnet`);
    const section = page.getByTestId("contract-functions");
    await expect(section.getByTestId("published-by-deployer-badge")).toBeVisible({ timeout: 20_000 });
    await expect(section.getByTestId("published-by-deployer-badge")).toHaveAttribute("href", /interfaces\/testnet/);
    await expect(section.getByTestId("contract-code-hash")).toBeVisible();
    await expect(section.getByTestId("contract-code-info")).not.toContainText("Deployed by");
  });
});

test.describe("contract functions (live testnet)", () => {
  test.skip(!LIVE, "set OBSERVER_CONTRACTS_LIVE=1");
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const c of CONTRACTS) {
    test(c.slug, async ({ page }) => {
      await page.goto(`/${c.path}/${c.id}?network=testnet`);
      const section = page.getByTestId("contract-functions");
      await expect(section).toBeVisible({ timeout: 60_000 });
      await expect(section.getByTestId("contract-interface-label")).toHaveText(c.label);
      const names = await section.getByTestId("contract-fn-name").allTextContents();
      expect(names.map((n) => n.split("(")[0])).toEqual(c.fns);
      await expect(section.getByTestId("contract-code-info")).toContainText(`${c.selectors} dispatch selector`);
      // Interface published on-chain by the deployer (hash + deployer verified) and exact code via boing_getContractCode.
      await expect(section.getByTestId("published-by-deployer-badge")).toBeVisible();
      await expect(section.getByTestId("contract-interface-source")).toContainText("published on-chain by the contract deployer");
      await expect(section.getByTestId("contract-code-hash")).toBeVisible();
      if (c.slug === "usdc-token") {
        await section.getByTestId("contract-fn-toggle-allowance").click();
        await section.getByTestId("contract-fn-input-allowance-owner").fill(`0x${"80".repeat(32)}`);
        await section.getByTestId("contract-fn-input-allowance-spender").fill(`0x${c.id}`);
        await section.getByTestId("contract-fn-run-allowance").click();
        await expect(section.getByTestId("contract-fn-result-allowance")).toContainText("word 0", { timeout: 20_000 });
      }
      await section.scrollIntoViewIfNeeded();
      if (SHOTS) await section.screenshot({ path: `${SHOTS}/after-17-${c.slug}.png` });
    });
  }
});