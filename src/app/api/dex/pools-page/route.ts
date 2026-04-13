import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, validateHex32 } from "boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { canonicalNativeDexFactoryHex, dexDiagnosticsEnabled } from "@/lib/server-dex-factory";
import { isMainnetConfigured } from "@/lib/rpc-client";
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
    const info = await client.getNetworkInfo();
    const factory = factoryOverride ?? canonicalNativeDexFactoryHex(info);
    if (!factory) {
      return NextResponse.json({
        supported: false as const,
        reason: "no_canonical_factory",
        message:
          "This RPC did not publish end_user.canonical_native_dex_factory. Set BOING_CANONICAL_NATIVE_DEX_FACTORY on the node or pass ?factory=0x…",
      });
    }

    const page = await client.listDexPoolsPage({
      factory,
      cursor: cursor || null,
      limit,
      light,
      includeDiagnostics: wantDiagnostics,
    });

    return NextResponse.json({
      supported: true as const,
      factory,
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
