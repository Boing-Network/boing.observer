import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, validateHex32 } from "boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { probeReferenceNftItem } from "@/lib/reference-nft-probe";
import { getRpcBaseUrl, isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const maxDuration = 60;
export const runtime = "nodejs";

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

function rpcHostLabel(network: NetworkId): string {
  try {
    return new URL(getRpcBaseUrl(network)).hostname;
  } catch {
    return "(rpc)";
  }
}

/**
 * GET /api/asset/nft?network=&collection=&tokenId=
 * Resolve one minted reference NFT (owner + metadata) by collection + opaque token id word.
 */
export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "Invalid or missing network (testnet | mainnet)" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const collectionParam = req.nextUrl.searchParams.get("collection");
  const tokenIdParam = req.nextUrl.searchParams.get("tokenId");
  if (!collectionParam || !tokenIdParam) {
    return NextResponse.json(
      { error: "Missing collection or tokenId (32-byte hex each)" },
      { status: 400 },
    );
  }

  let collectionPrefixed: string;
  let tokenIdPrefixed: string;
  try {
    collectionPrefixed = validateHex32(collectionParam);
    tokenIdPrefixed = validateHex32(tokenIdParam);
  } catch {
    return NextResponse.json({ error: "Invalid collection or tokenId (expect 32-byte hex)" }, { status: 400 });
  }

  const collection64 = normalizeHex64(collectionPrefixed.replace(/^0x/i, ""));
  const tokenId64 = normalizeHex64(tokenIdPrefixed.replace(/^0x/i, ""));
  if (!collection64 || !tokenId64) {
    return NextResponse.json({ error: "Invalid collection or tokenId (expect 32-byte hex)" }, { status: 400 });
  }

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const item = await probeReferenceNftItem(client, collectionPrefixed, tokenIdPrefixed);

    if (!item) {
      return NextResponse.json(
        {
          supported: true as const,
          found: false as const,
          network,
          collection: collection64,
          tokenId: tokenId64,
          headHeight: info.head_height,
          rpcHost: rpcHostLabel(network),
          error:
            "No owner or metadata storage for this token id on the collection contract. Confirm the collection AccountId and the opaque token id word (FreshMint uses sha256 of a listing key, not sequential #1..N).",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      supported: true as const,
      found: true as const,
      network,
      collection: collection64,
      tokenId: item.tokenIdWord,
      tokenIdU64: item.tokenIdU64,
      headHeight: info.head_height,
      rpcHost: rpcHostLabel(network),
      owner: item.owner,
      metadataHash: item.metadataHash || null,
      imageUrl: item.imageUrl,
      metadataUrl: item.metadataUrl,
      metadataName: item.metadataName,
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
