import { NextRequest, NextResponse } from "next/server";
import { fetchCpRoutingFromDirectoryLogs } from "boing-sdk";
import { BoingRpcError } from "boing-sdk";
import { validateHex32 } from "boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

function parseNetwork(v: unknown): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

type QuoteBody = {
  network?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  logs?: string;
};

/**
 * CP route quotes over native pools (read-only). Body: network, tokenIn, tokenOut, amountIn (decimal u128 string), logs=recent|full.
 */
export async function POST(req: NextRequest) {
  let body: QuoteBody;
  try {
    body = (await req.json()) as QuoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const network = parseNetwork(body.network);
  if (!network) {
    return NextResponse.json({ error: "Invalid network" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const { tokenIn, tokenOut, amountIn: amountInStr } = body;
  if (!tokenIn || !tokenOut || !amountInStr) {
    return NextResponse.json({ error: "tokenIn, tokenOut, and amountIn are required" }, { status: 400 });
  }

  let tin: string;
  let tout: string;
  try {
    tin = validateHex32(tokenIn);
    tout = validateHex32(tokenOut);
  } catch {
    return NextResponse.json({ error: "tokenIn and tokenOut must be 32-byte hex AccountIds (0x + 64 hex)" }, { status: 400 });
  }

  if (!/^\d+$/.test(amountInStr.trim())) {
    return NextResponse.json({ error: "amountIn must be a non-negative decimal integer string" }, { status: 400 });
  }
  const amountIn = BigInt(amountInStr.trim());

  const logsMode = body.logs === "full" ? "full" : "recent";

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const head = info.head_height;
    const registerLogs =
      logsMode === "full"
        ? { fromBlock: 0, toBlock: head }
        : { fromBlock: Math.max(0, head - 127), toBlock: head };

    const { snapshot, venues, routes } = await fetchCpRoutingFromDirectoryLogs(client, tin, tout, amountIn, {
      registerLogs,
      hydrateConcurrency: 4,
      maxHops: 3,
      maxRoutes: 16,
    });

    const serializedRoutes = routes.map((r) => ({
      amountIn: r.amountIn.toString(),
      amountOut: r.amountOut.toString(),
      tokenInHex: r.tokenInHex,
      tokenOutHex: r.tokenOutHex,
      hops: r.hops.map((h) => ({
        poolHex: h.venue.poolHex,
        tokenAHex: h.venue.tokenAHex,
        tokenBHex: h.venue.tokenBHex,
        tokenInHex: h.tokenInHex,
        tokenOutHex: h.tokenOutHex,
        amountIn: h.amountIn.toString(),
        amountOut: h.amountOut.toString(),
        directionForSwapCalldata: h.directionForSwapCalldata.toString(),
        feeBps: h.venue.feeBps.toString(),
      })),
    }));

    return NextResponse.json({
      chainId: snapshot.chainId,
      headHeight: snapshot.headHeight,
      pairsCount: snapshot.pairsCount !== null ? snapshot.pairsCount.toString() : null,
      logsMode,
      venueCount: venues.length,
      routes: serializedRoutes,
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
