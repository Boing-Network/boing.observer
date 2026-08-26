import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, fetchBlocksWithReceiptsForHeightRange, validateHex32 } from "boing-sdk";
import {
  ACCOUNT_TX_HISTORY_WINDOWS,
  DEFAULT_ACCOUNT_TX_HISTORY_WINDOW,
  collectAccountTxHistory,
  type AccountTxHistoryScanBlock,
} from "@/lib/account-tx-history";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const maxDuration = 120;
export const runtime = "nodejs";

const ALLOWED_WINDOWS: readonly number[] = ACCOUNT_TX_HISTORY_WINDOWS;

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
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

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const toHeight = info.head_height;
    const fromHeight = Math.max(0, toHeight - (windowBlocks - 1));
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
      note: "Bounded scan of committed blocks (not a full chain indexer). Older txs may be missing if they sit outside this window or on a pruned node.",
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
