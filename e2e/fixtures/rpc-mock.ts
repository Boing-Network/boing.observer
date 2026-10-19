import type { Page, Route } from "@playwright/test";

type JsonRpcBody = {
  jsonrpc?: string;
  id?: number;
  method?: string;
};

/**
 * The browser calls JSON-RPC via same-origin `POST /api/rpc`. Stub selected methods so
 * account/tx flows do not depend on a live tunnel to the public testnet RPC (local e2e
 * often sees HTTP 530 from the upstream).
 */
export async function installMinimalRpcMocks(page: Page): Promise<void> {
  await page.route("**/api/account/history**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        address: "1e1a11f9eb8612aee66bdf0286dbb29ca662cadf7d76e384ac19449d62433615",
        headHeight: 1,
        scannedFromHeight: 0,
        scannedToHeight: 1,
        blocksFetched: 1,
        items: [],
        note: "e2e mock — bounded scan not run",
      }),
    });
  });

  // Asset profile (scan=1 walks every block server-side) and linked companions hit the live
  // testnet from the Next server; stub them so CI timing does not depend on chain length.
  await page.route("**/api/asset/profile**", async (route: Route) => {
    const id = new URL(route.request().url()).searchParams.get("id") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        supported: true,
        address: id.replace(/^0x/i, "").toLowerCase(),
        headHeight: 1,
        rpcHost: "e2e-mock",
        factory: null,
        dexSupported: false,
        dexToken: null,
        tokenIndex: null,
        tokenIndexScan: null,
        imageUrl: null,
        description: null,
      }),
    });
  });

  await page.route("**/api/asset/companions**", async (route: Route) => {
    const id = new URL(route.request().url()).searchParams.get("id") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        supported: true,
        network: "testnet",
        address: id,
        registryId: null,
        registrySource: "e2e-mock",
        slotCount: 0,
        companions: [],
        managedLinks: [],
        rpcHost: "e2e-mock",
        note: "e2e mock — registry not queried",
      }),
    });
  });

  await page.route("**/api/rpc", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    let body: JsonRpcBody;
    try {
      body = JSON.parse(route.request().postData() ?? "{}") as JsonRpcBody;
    } catch {
      await route.continue();
      return;
    }
    const id = typeof body.id === "number" ? body.id : 0;
    const method = body.method;

    const reply = (result: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id, result }),
      });

    switch (method) {
      case "boing_getTransactionReceipt":
        await reply(null);
        return;
      case "boing_getAccount":
        await reply({ balance: "0", nonce: 0, stake: "0" });
        return;
      case "boing_getNetworkInfo":
        await reply({
          head_height: 1,
          end_user: {},
        });
        return;
      case "boing_getContractStorage":
        await reply({ value: `0x${"00".repeat(32)}` });
        return;
      default:
        await route.continue();
    }
  });
}
