import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, validateHex32 } from "boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { canonicalNativeDexFactoryHex } from "@/lib/server-dex-factory";
import { isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

/**
 * Lightweight `boing_getDexToken` for explorer badges — never returns row.diagnostics to browsers.
 */
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
    return NextResponse.json({ error: "Missing id (32-byte hex account / token)" }, { status: 400 });
  }

  let id: string;
  try {
    id = validateHex32(idParam);
  } catch {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const factory = canonicalNativeDexFactoryHex(info);
    if (!factory) {
      return NextResponse.json({
        supported: false as const,
        inDexUniverse: false,
        reason: "no_canonical_factory",
      });
    }

    const row = await client.getDexToken(id, { factory, light: true });
    if (!row) {
      return NextResponse.json({ supported: true as const, inDexUniverse: false, token: null });
    }
    const { diagnostics: _omit, ...token } = row;
    void _omit;
    return NextResponse.json({ supported: true as const, inDexUniverse: true, token });
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
