import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, validateHex32 } from "@boing-network/boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { dexDiagnosticsEnabled } from "@/lib/server-dex-factory";
import { resolveNativeDexFactoryForExplorer } from "@/lib/resolve-native-dex-factory";
import { getRpcBaseUrl, isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

function clampLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(1, n));
}

export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "Invalid or missing network (testnet | mainnet)" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const light = req.nextUrl.searchParams.get("light") === "1";
  const wantDiagnostics = req.nextUrl.searchParams.get("diagnostics") === "1" && dexDiagnosticsEnabled();

  let factoryOverride: string | undefined;
  const factoryParam = req.nextUrl.searchParams.get("factory");
  if (factoryParam) {
    try {
      factoryOverride = validateHex32(factoryParam);
    } catch {
      return NextResponse.json({ error: "Invalid factory (expect 32-byte hex)" }, { status: 400 });
    }
  }

  try {
    const client = createServerBoingClient(network);
    const factory = factoryOverride ?? (await resolveNativeDexFactoryForExplorer(client));
    if (!factory) {
      return NextResponse.json({
        supported: false as const,
        reason: "no_canonical_factory",
        message:
          "No factory address resolved for DEX discovery. Set BOING_CANONICAL_NATIVE_DEX_FACTORY on the node, pass ?factory=0x…, or set BOING_NATIVE_VM_DEX_FACTORY / BOING_DEX_FACTORY_HEX on this host (see boing-sdk mergeNativeDexIntegrationDefaults).",
      });
    }

    const [page, netInfo] = await Promise.all([
      client.listDexPoolsPage({
        factory,
        cursor: cursor || null,
        limit,
        light,
        includeDiagnostics: wantDiagnostics,
      }),
      client.getNetworkInfo(),
    ]);

    let rpcHost: string;
    try {
      rpcHost = new URL(getRpcBaseUrl(network)).hostname;
    } catch {
      rpcHost = "";
    }

    return NextResponse.json({
      supported: true as const,
      factory,
      tipHeight: netInfo.head_height,
      rpcHost,
      pools: page.pools,
      nextCursor: page.nextCursor,
      ...(wantDiagnostics && page.diagnostics ? { diagnostics: page.diagnostics } : {}),
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
