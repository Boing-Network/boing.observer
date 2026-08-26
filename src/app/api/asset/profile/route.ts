import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError, validateHex32 } from "boing-sdk";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { resolveNativeDexFactoryForExplorer } from "@/lib/resolve-native-dex-factory";
import { resolveImageUrlFromSources } from "@/lib/extract-media-url";
import { buildTokenIndexForHeightRange } from "@/lib/token-index/build-token-index";
import { probeReferenceNftCollectionSamples } from "@/lib/reference-nft-probe";
import { getRpcBaseUrl, isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";
import type { TokenIndexJsonEntry } from "@/lib/token-index/types";

export const maxDuration = 120;
export const runtime = "nodejs";

const PROFILE_INDEX_WINDOW = 256;

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

  let idPrefixed: string;
  try {
    idPrefixed = validateHex32(idParam);
  } catch {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }

  const address64 = normalizeHex64(idPrefixed.replace(/^0x/i, ""));
  if (!address64) {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }

  const wantIndexScan =
    req.nextUrl.searchParams.get("scan") === "1" || req.nextUrl.searchParams.get("scan") === "true";

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const headHeight = info.head_height;
    const rpcHost = rpcHostLabel(network);

    const factory = await resolveNativeDexFactoryForExplorer(client);
    let dexToken: Record<string, unknown> | null = null;
    if (factory) {
      const row = await client.getDexToken(idPrefixed, { factory, light: false });
      if (row) {
        const { diagnostics: _omit, ...rest } = row;
        void _omit;
        dexToken = rest as Record<string, unknown>;
      }
    }

    let tokenIndex: TokenIndexJsonEntry | null = null;
    let indexWarnings: string[] | undefined;
    let tokenIndexScan: { fromHeight: number; toHeight: number } | null = null;

    if (wantIndexScan) {
      const toHeight = headHeight;
      const fromHeight = Math.max(0, toHeight - (PROFILE_INDEX_WINDOW - 1));
      const indexResult = await buildTokenIndexForHeightRange(client, fromHeight, toHeight, { maxConcurrent: 8 });
      tokenIndexScan = { fromHeight, toHeight };
      indexWarnings = indexResult.indexWarnings;
      tokenIndex = indexResult.entries.find((e) => e.address === address64) ?? null;
    }

    const imageUrl = resolveImageUrlFromSources(
      typeof dexToken?.name === "string" ? dexToken.name : null,
      typeof dexToken?.symbol === "string" ? dexToken.symbol : null,
      tokenIndex?.assetName,
      tokenIndex?.assetSymbol,
    );

    const isNftCollection =
      tokenIndex?.kind === "nft" ||
      (tokenIndex?.purposeCategory ?? "").toLowerCase().includes("nft");

    let nftSamples: Awaited<ReturnType<typeof probeReferenceNftCollectionSamples>> = [];
    if (isNftCollection) {
      nftSamples = await probeReferenceNftCollectionSamples(client, idPrefixed, { maxProbe: 8 });
    }

    const nftPreviewImage =
      imageUrl ?? nftSamples.find((s) => s.imageUrl)?.imageUrl ?? null;

    return NextResponse.json({
      supported: true as const,
      address: address64,
      headHeight,
      rpcHost,
      factory,
      dexSupported: Boolean(factory),
      dexToken,
      tokenIndex,
      tokenIndexScan,
      imageUrl: nftPreviewImage,
      nftSamples: nftSamples.length ? nftSamples : undefined,
      ...(indexWarnings && indexWarnings.length ? { indexWarnings } : {}),
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
