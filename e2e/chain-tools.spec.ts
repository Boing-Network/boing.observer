import { test, expect, type Page, type Route } from "@playwright/test";
import { installMinimalRpcMocks } from "./fixtures/rpc-mock";

const ACCOUNT = "1e1a11f9eb8612aee66bdf0286dbb29ca662cadf7d76e384ac19449d62433615";
const ROOT = "ab".repeat(32);
const HEAD = 2_000_000;

type Handlers = Record<string, (params: unknown[]) => unknown | { __error: { code: number; message: string } }>;

/** Layer per-method RPC answers over the minimal mocks; anything unlisted falls through to them. */
async function mockRpc(page: Page, handlers: Handlers) {
  await installMinimalRpcMocks(page);
  await page.route("**/api/rpc", async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = JSON.parse(route.request().postData() ?? "{}") as { id?: number; method?: string; params?: unknown[] };
    const h = body.method ? handlers[body.method] : undefined;
    if (!h) return route.fallback();
    const out = h(body.params ?? []);
    const id = typeof body.id === "number" ? body.id : 0;
    const payload =
      out && typeof out === "object" && "__error" in (out as object)
        ? { jsonrpc: "2.0", id, error: (out as { __error: unknown }).__error }
        : { jsonrpc: "2.0", id, result: out };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

const blockAt = (height: number, stateRoot: string) => ({
  hash: "cc".repeat(32),
  header: {
    height,
    parent_hash: "dd".repeat(32),
    state_root: stateRoot,
    tx_root: "ff".repeat(32),
    timestamp: 1_700_000_000,
    proposer: "aa".repeat(32),
  },
  transactions: [],
});

test.describe("missing receipts (retention)", () => {
  test("explains possible pruning when the head is past the retention window", async ({ page }) => {
    await mockRpc(page, { boing_chainHeight: () => HEAD });
    await page.goto(`/tx/${"f".repeat(64)}`);
    await expect(page.getByText(/No receipt for this id/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("missing-receipt-detail")).toContainText(/may have been pruned/i, { timeout: 20_000 });
    await expect(page.getByTestId("missing-receipt-detail")).toContainText("#1000000");
  });

  test("says the id is unknown on a young chain", async ({ page }) => {
    await mockRpc(page, { boing_chainHeight: () => 1200 });
    await page.goto(`/tx/${"f".repeat(64)}`);
    await expect(page.getByTestId("missing-receipt-detail")).toContainText(/No transaction with this id is known/i, {
      timeout: 20_000,
    });
  });
});

test.describe("account proof tool", () => {
  test("verifies a proof and anchors its root to the head block", async ({ page }) => {
    await mockRpc(page, {
      boing_getAccountProof: () => ({ proof: "0xdeadbeef", root: ROOT, value_hash: "0x" + "12".repeat(32) }),
      boing_verifyAccountProof: () => ({ valid: true }),
      boing_chainHeight: () => HEAD,
      boing_getBlockByHeight: (p) => blockAt(Number(p[0]), ROOT),
    });
    await page.goto(`/tools/account-proof?address=${ACCOUNT}`);
    await expect(page.locator("#proof-address")).toHaveValue(ACCOUNT);
    await page.getByRole("button", { name: /Fetch & verify proof/i }).click();
    await expect(page.getByTestId("proof-verified")).toContainText(/^Valid/, { timeout: 20_000 });
    await expect(page.getByTestId("proof-anchor")).toContainText(`block #${HEAD}`);
    await expect(page.getByTestId("proof-trust-note")).toContainText(/second, independent node/i);
  });

  test("flags a root that matches none of the newest blocks and an invalid proof", async ({ page }) => {
    await mockRpc(page, {
      boing_getAccountProof: () => ({ proof: "0xdeadbeef", root: ROOT, value_hash: "" }),
      boing_verifyAccountProof: () => ({ valid: false }),
      boing_chainHeight: () => HEAD,
      boing_getBlockByHeight: (p) => blockAt(Number(p[0]), "00".repeat(32)),
    });
    await page.goto("/tools/account-proof");
    await page.locator("#proof-address").fill(ACCOUNT);
    await page.getByRole("button", { name: /Fetch & verify proof/i }).click();
    await expect(page.getByTestId("proof-verified")).toContainText(/^Invalid/, { timeout: 20_000 });
    await expect(page.getByTestId("proof-anchor")).toContainText(/does not equal/i);
  });

  test("degrades cleanly when the RPC lacks account proofs", async ({ page }) => {
    await mockRpc(page, {
      boing_getAccountProof: () => ({ __error: { code: -32601, message: "Method not found" } }),
    });
    await page.goto("/tools/account-proof");
    await page.locator("#proof-address").fill(ACCOUNT);
    await page.getByRole("button", { name: /Fetch & verify proof/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /does not expose account proofs/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("rejects malformed account ids without calling the RPC", async ({ page }) => {
    await page.goto("/tools/account-proof");
    await page.locator("#proof-address").fill("0xdeadbeef");
    await page.getByRole("button", { name: /Fetch & verify proof/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /32-byte account id/i })).toBeVisible();
  });
});

test.describe("node health + RPC catalog use chain metadata and protocol specs", () => {
  test("warns when the RPC reports another chain id and shows client hints", async ({ page }) => {
    await mockRpc(page, {
      boing_chainHeight: () => 10,
      boing_getSyncState: () => ({ head_height: 10, finalized_height: 9, latest_block_hash: "0x" + "ab".repeat(32) }),
      boing_health: () => ({
        ok: true,
        client_version: "x",
        chain_id: 9999,
        chain_name: "Elsewhere",
        head_height: 10,
        client_hints: { min_wallet_version: "0.1.15", recommended_wallet_version: "0.1.22", recommended_sdk: "0.5.38" },
      }),
    });
    await page.goto("/tools/node-health");
    await expect(page.getByTestId("chain-id-mismatch")).toContainText(/6913/, { timeout: 20_000 });
    await expect(page.getByTestId("client-hints")).toContainText("0.1.22");
  });

  test("no mismatch warning when the chain id matches", async ({ page }) => {
    await mockRpc(page, {
      boing_chainHeight: () => 10,
      boing_getSyncState: () => ({ head_height: 10, finalized_height: 9, latest_block_hash: "0x" + "ab".repeat(32) }),
      boing_health: () => ({ ok: true, client_version: "x", chain_id: 6913, chain_name: "Boing Testnet", head_height: 10 }),
    });
    await page.goto("/tools/node-health");
    await expect(page.getByText("boing_health", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("chain-id-mismatch")).toHaveCount(0);
    await expect(page.getByTestId("client-hints")).toHaveCount(0);
  });

  test("rpc catalog renders protocol_specs sections", async ({ page }) => {
    await mockRpc(page, {
      boing_getRpcMethodCatalog: () => ({
        description: "catalog",
        protocol_specs: { version: 1, note: "additive", priority_tips: { units: "ledger units" } },
        methods: [{ name: "boing_health", summary: "Liveness" }],
      }),
    });
    await page.goto("/tools/rpc-catalog");
    await expect(page.getByTestId("protocol-specs")).toContainText("priority_tips", { timeout: 20_000 });
    await expect(page.getByTestId("protocol-specs")).toContainText("(v1)");
  });
});