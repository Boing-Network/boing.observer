import { NextRequest, NextResponse } from "next/server";
import { validateHex32 } from "boing-sdk";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Proxy to the durable NFT-owner indexer Worker (`workers/nft-owner-indexer` in boing.network).
 * Set NFT_OWNER_INDEXER_URL (e.g. https://boing-nft-owner-indexer.<account>.workers.dev).
 */

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

function indexerBaseUrl(): string | null {
  const raw =
    process.env.NFT_OWNER_INDEXER_URL?.trim() ||
    process.env.BOING_NFT_OWNER_INDEXER_URL?.trim() ||
    "";
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json(
      { error: "Invalid or missing network (testnet | mainnet)" },
      { status: 400 },
    );
  }

  const idParam = req.nextUrl.searchParams.get("id") ?? req.nextUrl.searchParams.get("owner");
  if (!idParam) {
    return NextResponse.json({ error: "Missing id (32-byte hex account)" }, { status: 400 });
  }

  let owner: string;
  try {
    const bare = normalizeHex64(validateHex32(idParam).replace(/^0x/i, ""));
    if (!bare) {
      return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
    }
    owner = `0x${bare}`;
  } catch {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }

  const base = indexerBaseUrl();
  if (!base) {
    return NextResponse.json(
      {
        error: "NFT owner indexer is not configured",
        hint: "Set NFT_OWNER_INDEXER_URL to the boing-nft-owner-indexer Worker origin (see boing.network docs/HANDOFF_NFT_OWNER_INDEX.md).",
        owner,
        network,
        items: [],
      },
      { status: 503 },
    );
  }

  const limit = req.nextUrl.searchParams.get("limit");
  const cursor = req.nextUrl.searchParams.get("cursor");
  const collection = req.nextUrl.searchParams.get("collection");
  const qs = new URLSearchParams({ owner });
  if (limit) qs.set("limit", limit);
  if (cursor) qs.set("cursor", cursor);
  if (collection) qs.set("collection", collection);

  try {
    const upstream = await fetch(`${base}/v1/nfts/by-owner?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      return NextResponse.json(
        { error: typeof body.error === "string" ? body.error : "Indexer error", upstream: body },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }
    return NextResponse.json({
      ...body,
      network,
      source: "nft-owner-indexer",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to reach NFT owner indexer",
        owner,
        network,
      },
      { status: 502 },
    );
  }
}
