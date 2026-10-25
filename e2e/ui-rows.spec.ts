import { test, expect, type Page, type Route } from "@playwright/test";
import { installMinimalRpcMocks } from "./fixtures/rpc-mock";

const SENDER = "aa".repeat(32);
const RECIPIENT = "bb".repeat(32);
const TX_OK = "11".repeat(32);
const TX_FAILED = "22".repeat(32);
const HEIGHT = 1100; // >= testnet base-unit activation (1050)
const ACCOUNT = "1e1a11f9eb8612aee66bdf0286dbb29ca662cadf7d76e384ac19449d62433615";

type Mode = { feePolicy: boolean; omitPriorityTips: boolean };

const FEE_POLICY = {
  fee_validators_bps: 7000,
  fee_treasury_bps: 2000,
  fee_burn_bps: 1000,
  execution_gas_fee_bps: 250,
  extra_fixed_fee: "0",
  transfer_amount_bps: 0,
  blob_base_fee_per_kib: "0",
  blob_forever_pin_fee_per_kib: "0",
  free_tx_min_balance: "0",
  tip_proposer_bps: 8000,
  tip_treasury_bps: 1000,
  tip_burn_bps: 1000,
};

function block(mode: Mode) {
  const tx = (nonce: number) => ({
    nonce,
    sender: SENDER,
    payload: { Transfer: { to: RECIPIENT, amount: "1000000000000000000" } },
  });
  const receipts = [
    { tx_id: TX_OK, block_height: HEIGHT, tx_index: 0, success: true, gas_used: 21000 },
    { tx_id: TX_FAILED, block_height: HEIGHT, tx_index: 1, success: false, gas_used: 21000, error: "revert" },
  ];
  return {
    hash: "cc".repeat(32),
    header: {
      height: HEIGHT,
      parent_hash: "dd".repeat(32),
      state_root: "ee".repeat(32),
      tx_root: "ff".repeat(32),
      timestamp: 1_700_000_000,
      proposer: SENDER,
    },
    transactions: [tx(0), tx(1)],
    receipts,
    ...(mode.omitPriorityTips ? {} : { priority_tips: ["2500000000000000", 0] }),
  };
}

/** Layer fee-policy / block / account mocks over the minimal explorer mocks (later routes win). */
async function install(page: Page, mode: Mode, account?: Record<string, unknown>) {
  await installMinimalRpcMocks(page);
  await page.route("**/api/rpc", async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    let body: { id?: number; method?: string; params?: unknown[] } = {};
    try {
      body = JSON.parse(route.request().postData() ?? "{}");
    } catch {
      return route.fallback();
    }
    const id = typeof body.id === "number" ? body.id : 0;
    const ok = (result: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id, result }) });
    switch (body.method) {
      case "boing_getNetworkInfo":
        return ok({
          head_height: HEIGHT + 5,
          end_user: {},
          ...(mode.feePolicy ? { native_currency: { decimals: 18, base_units_from_height: 1050 } } : {}),
        });
      case "boing_getNetworkFeePolicy":
        if (!mode.feePolicy) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }),
          });
        }
        return ok(FEE_POLICY);
      case "boing_getTransactionReceipt": {
        const want = String(body.params?.[0] ?? "").replace(/^0x/, "");
        if (want === TX_OK) return ok({ tx_id: TX_OK, block_height: HEIGHT, tx_index: 0, success: true, gas_used: 21000 });
        if (want === TX_FAILED)
          return ok({ tx_id: TX_FAILED, block_height: HEIGHT, tx_index: 1, success: false, gas_used: 21000, error: "revert" });
        return ok(null);
      }
      case "boing_getBlockByHeight":
        return ok(Number(body.params?.[0]) === HEIGHT ? block(mode) : null);
      case "boing_getAccount":
        return ok(account ?? { balance: "0", nonce: 0, stake: "0" });
      case "boing_chainHeight":
        return ok(HEIGHT + 5);
      default:
        return route.fallback();
    }
  });
}

test.describe("priority tips", () => {
  test("tx page shows the tip on a tipped transaction", async ({ page }) => {
    await install(page, { feePolicy: true, omitPriorityTips: false });
    await page.goto(`/tx/${TX_OK}`);
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("priority-tip")).toBeVisible();
    await expect(page.getByTestId("priority-tip")).toContainText("0.0025");
  });

  test("tx page renders without a tip when Block.priority_tips is absent", async ({ page }) => {
    await install(page, { feePolicy: true, omitPriorityTips: true });
    await page.goto(`/tx/${TX_OK}`);
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/Signable payload id/i)).toBeVisible();
    await expect(page.getByTestId("priority-tip")).toHaveCount(0);
  });

  test("block page summarizes tips and tolerates their absence", async ({ page }) => {
    await install(page, { feePolicy: true, omitPriorityTips: false });
    await page.goto(`/block/${HEIGHT}`);
    await expect(page.getByTestId("block-priority-tips")).toContainText("1 tx", { timeout: 20_000 });

    const page2 = await page.context().newPage();
    await install(page2, { feePolicy: true, omitPriorityTips: true });
    await page2.goto(`/block/${HEIGHT}`);
    await expect(page2.getByText(/Transactions \(2\)/)).toBeVisible({ timeout: 20_000 });
    await expect(page2.getByTestId("block-priority-tips")).toHaveCount(0);
  });
});

test.describe("fee policy driven estimates", () => {
  test("failed tx fee uses the node's live execution_gas_fee_bps", async ({ page }) => {
    await install(page, { feePolicy: true, omitPriorityTips: true });
    await page.goto(`/tx/${TX_FAILED}`);
    const row = page.getByTestId("failed-tx-fee");
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("fee-policy-source")).toHaveAttribute("data-source", "live");
    // 21000 gas * 1e12 base units * 250/10000 = 5.25e14 base units = 0.000525 BOING
    await expect(row).toContainText("0.000525");
  });

  test("falls back to the default micro-fee policy when the node has none", async ({ page }) => {
    await install(page, { feePolicy: false, omitPriorityTips: true });
    await page.goto(`/tx/${TX_FAILED}`);
    await expect(page.getByTestId("fee-policy-source")).toHaveAttribute("data-source", "fallback", { timeout: 20_000 });
    // 21000 * 1e12 * 100/10000 = 2.1e14 = 0.00021 BOING
    await expect(page.getByTestId("failed-tx-fee")).toContainText("0.00021");
  });
});

test.describe("account pending unbond", () => {
  test("shows the unbonding row with unlock height", async ({ page }) => {
    await install(page, { feePolicy: true, omitPriorityTips: true }, {
      balance: "0",
      nonce: 0,
      stake: "0",
      decimals: 18,
      pending_unbond: "3000000000000000000",
      unbond_unlock_height: 4321,
    });
    await page.goto(`/account/${ACCOUNT}`);
    const row = page.getByTestId("account-pending-unbond");
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText("3");
    await expect(row).toContainText("#4321");
  });

  test("hides the unbonding row when nothing is pending", async ({ page }) => {
    await install(page, { feePolicy: true, omitPriorityTips: true });
    await page.goto(`/account/${ACCOUNT}`);
    await expect(page.getByRole("heading", { name: /^Account$/i })).toBeVisible();
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId("account-pending-unbond")).toHaveCount(0);
  });
});