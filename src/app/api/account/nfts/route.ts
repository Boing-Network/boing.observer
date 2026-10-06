import { NextRequest, NextResponse } from "next/server";
import { validateHex32 } from "boing-sdk";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Proxy to the durable NFT-owner indexer Worker (`workers/nft-owner-indexer` in boing.network).
 * Set NFT_OWNER_INDEXER_URL (e.g. https://boing-nft-owner-indexer.<account>.workers.dev).
 *
 * CORS is intentionally permissive (read-only, no auth/cookies): this proxy is the documented
 * integration point for cross-origin consumers like the Boing Express wallet (web + extension
 * popup), not just the explorer's own same-origin pages — see docs/HANDOFF_NFT_OWNER_INDEX.md.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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
    return corsJson({ error: "Invalid or missing network (testnet | mainnet)" }, 400);
  }

  const idParam = req.nextUrl.searchParams.get("id") ?? req.nextUrl.searchParams.get("owner");
  if (!idParam) {
    return corsJson({ error: "Missing id (32-byte hex account)" }, 400);
  }

  let owner: string;
  try {
    const bare = normalizeHex64(validateHex32(idParam).replace(/^0x/i, ""));
    if (!bare) {
      return corsJson({ error: "Invalid id (expect 32-byte hex)" }, 400);
    }
    owner = `0x${bare}`;
  } catch {
    return corsJson({ error: "Invalid id (expect 32-byte hex)" }, 400);
  }

  const base = indexerBaseUrl();
  if (!base) {
    return corsJson(
      {
        error: "NFT owner indexer is not configured",
        hint: "Set NFT_OWNER_INDEXER_URL to the boing-nft-owner-indexer Worker origin (see boing.network docs/HANDOFF_NFT_OWNER_INDEX.md).",
        owner,
        network,
        items: [],
      },
      503,
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
      return corsJson(
        { error: typeof body.error === "string" ? body.error : "Indexer error", upstream: body },
        upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
      );
    }
    return corsJson(
      {
        ...body,
        network,
        source: "nft-owner-indexer",
      },
      200,
    );
  } catch (e) {
    return corsJson(
      {
        error: e instanceof Error ? e.message : "Failed to reach NFT owner indexer",
        owner,
        network,
      },
      502,
    );
  }
}
