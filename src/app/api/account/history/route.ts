import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, fetchBlocksWithReceiptsForHeightRange, validateHex32 } from "boing-sdk";
import {
  ACCOUNT_TX_HISTORY_WINDOWS,
  DEFAULT_ACCOUNT_TX_HISTORY_WINDOW,
  collectAccountTxHistory,
  collectIndexedAccountTxHistory,
  type AccountTxHistoryScanBlock,
  type IndexedAccountTxRow,
} from "@/lib/account-tx-history";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { getRpcBaseUrl, getTestnetRpcCandidates, isMainnetConfigured, rpcCall } from "@/lib/rpc-client";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const maxDuration = 120;
export const runtime = "nodejs";

const ALLOWED_WINDOWS: readonly number[] = ACCOUNT_TX_HISTORY_WINDOWS;

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

type Rpc = <T>(method: string, params: unknown[]) => Promise<T>;

async function fetchIndexedWindow(
  rpc: Rpc,
  address64: string,
  fromHeight: number,
): Promise<{ items: ReturnType<typeof collectIndexedAccountTxHistory>; pages: number; supported: boolean }> {
  const rows: IndexedAccountTxRow[] = [];
  let cursor: string | null = null;
  let pages = 0;
  let supported = false;
  for (let page = 0; page < 16; page += 1) {
    let result: { transactions?: IndexedAccountTxRow[]; next_cursor?: string | null };
    try {
      // Raw RPC: pinned boing-sdk client may not expose getAccountTransactions yet.
      result = await rpc("boing_getAccountTransactions", [`0x${address64}`, { cursor, limit: 100 }]);
      supported = true;
    } catch {
      return { items: [], pages, supported: page > 0 };
    }
    pages += 1;
    const batch = result.transactions ?? [];
    for (const row of batch) {
      if ((row.block_height ?? 0) < fromHeight) {
        // Newest-first: once we cross the window floor, stop paging.
        return {
          items: collectIndexedAccountTxHistory(rows, { minHeight: fromHeight }),
          pages,
          supported,
        };
      }
      rows.push(row);
    }
    cursor = result.next_cursor ?? null;
    if (!cursor) break;
  }
  return {
    items: collectIndexedAccountTxHistory(rows, { minHeight: fromHeight }),
    pages,
    supported,
  };
}

function rpcBases(network: NetworkId): string[] {
  return network === "testnet" ? getTestnetRpcCandidates() : [getRpcBaseUrl(network)];
}

async function withRpcFailover<T>(network: NetworkId, fn: (rpc: Rpc, baseUrl: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const base of rpcBases(network)) {
    const rpc: Rpc = (method, params) => rpcCall(network, base, method, params);
    try {
      return await fn(rpc, base);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("All RPC candidates failed");
}

export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "Invalid or missing network (testnet | mainnet)" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) {
    return NextResponse.json({ error: "Missing id (32-byte hex account)" }, { status: 400 });
  }

  let address64: string;
  try {
    address64 = normalizeHex64(validateHex32(idParam).replace(/^0x/i, ""));
  } catch {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }
  if (!address64) {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }

  const windowRaw = parseInt(req.nextUrl.searchParams.get("window") ?? String(DEFAULT_ACCOUNT_TX_HISTORY_WINDOW), 10);
  const windowBlocks = ALLOWED_WINDOWS.includes(windowRaw) ? windowRaw : DEFAULT_ACCOUNT_TX_HISTORY_WINDOW;
  const preferScan =
    req.nextUrl.searchParams.get("source") === "scan" ||
    req.nextUrl.searchParams.get("source") === "blocks";

  try {
    return await withRpcFailover(network, async (rpc, baseUrl) => {
      const info = await rpc<{ head_height: number }>("boing_getNetworkInfo", []);
      const toHeight = info.head_height;
      const fromHeight = Math.max(0, toHeight - (windowBlocks - 1));

      if (!preferScan) {
        const indexed = await fetchIndexedWindow(rpc, address64, fromHeight);
        if (indexed.supported && indexed.items.length > 0) {
          return NextResponse.json({
            address: address64,
            headHeight: toHeight,
            scannedFromHeight: fromHeight,
            scannedToHeight: toHeight,
            blocksFetched: indexed.pages,
            items: indexed.items,
            source: "indexed" as const,
            note: "Node-indexed account history (boing_getAccountTransactions) filtered to this block window. Includes calls and transfers that touch this address; deploy-only “created” rows may still require a block scan.",
          });
        }
      }

      const client = createServerBoingClient(network, baseUrl);
      const bundles = await fetchBlocksWithReceiptsForHeightRange(client, fromHeight, toHeight, {
        maxConcurrent: 8,
        onMissingBlock: "omit",
      });

      const scanBlocks: AccountTxHistoryScanBlock[] = bundles.map((bundle) => ({
        height: bundle.height,
        timestamp:
          bundle.block.header?.timestamp == null ? null : Number(bundle.block.header.timestamp),
        transactions: (bundle.block.transactions ?? []) as AccountTxHistoryScanBlock["transactions"],
        receipts: (bundle.block.receipts ?? null) as AccountTxHistoryScanBlock["receipts"],
      }));

      const items = collectAccountTxHistory(address64, scanBlocks);
      return NextResponse.json({
        address: address64,
        headHeight: toHeight,
        scannedFromHeight: fromHeight,
        scannedToHeight: toHeight,
        blocksFetched: bundles.length,
        items,
        source: "scan" as const,
        note: "Bounded scan of committed blocks (not a full chain indexer). Older txs may be missing if they sit outside this window or on a pruned node.",
      });
    });
  } catch (e) {
    const message =
      e instanceof BoingRpcError
        ? `${e.message} (RPC ${e.method ?? "?"})`
        : e instanceof Error
          ? e.message
          : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
