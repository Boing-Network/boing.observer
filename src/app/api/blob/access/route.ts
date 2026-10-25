import { NextRequest, NextResponse } from "next/server";
import { getRpcBaseUrl, isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

/** Public ACL metadata via `boing_getBlobAccess` (no bytes). */
export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "Missing or invalid network (testnet | mainnet)" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const blobId = normalizeHex64(req.nextUrl.searchParams.get("id") ?? "");
  if (!blobId) {
    return NextResponse.json({ error: "Invalid blob id (64 hex characters)." }, { status: 400 });
  }

  const base = getRpcBaseUrl(network).replace(/\/$/, "");
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "boing_getBlobAccess",
        params: [`0x${blobId}`],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json()) as {
      result?: {
        publisher?: string;
        grantees?: string[];
        epoch?: number;
        aclActive?: boolean;
      } | null;
      error?: { message?: string };
    };
    if (json.error) {
      return NextResponse.json(
        { error: json.error.message || "boing_getBlobAccess failed", publisher: null, grantees: [] },
        { status: 502 }
      );
    }
    if (!json.result) {
      return NextResponse.json({ publisher: null, grantees: [], epoch: 0 });
    }
    return NextResponse.json({
      publisher: json.result.publisher ?? null,
      grantees: json.result.grantees ?? [],
      epoch: json.result.epoch ?? 0,
      aclActive: Boolean(json.result.aclActive),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "RPC unreachable";
    return NextResponse.json({ error: message, publisher: null, grantees: [] }, { status: 502 });
  }
}
