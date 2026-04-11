import { NextRequest, NextResponse } from "next/server";
import { fetchNativeDexDirectorySnapshot } from "boing-sdk";
import { BoingRpcError } from "boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

/**
 * Native DEX directory snapshot (boing-sdk). Query: network, logs=none|recent|full
 * — see HANDOFF-DEPENDENT-PROJECTS / BOING-OBSERVER-AND-EXPRESS §4.3.
 * Optional alternative: Worker `GET /v1/directory/meta` + `/v1/directory/pools` (indexer D1;
 * snapshot semantics) — docs/HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md in boing.network.
 */
export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "Invalid or missing network (testnet | mainnet)" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const logsMode = req.nextUrl.searchParams.get("logs") ?? "none";

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const head = info.head_height;

    const registerLogs =
      logsMode === "full"
        ? { fromBlock: 0, toBlock: head }
        : logsMode === "recent"
          ? { fromBlock: Math.max(0, head - 127), toBlock: head }
          : undefined;

    const snap = await fetchNativeDexDirectorySnapshot(client, {
      registerLogs,
    });

    return NextResponse.json({
      chainId: snap.chainId,
      headHeight: snap.headHeight,
      pairsCount: snap.pairsCount !== null ? snap.pairsCount.toString() : null,
      defaults: snap.defaults,
      registerLogs: snap.registerLogs,
      logsMode: registerLogs ? logsMode : "none",
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
