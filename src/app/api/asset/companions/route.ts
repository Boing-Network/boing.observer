import { NextRequest, NextResponse } from "next/server";
import { validateHex32 } from "@boing-network/boing-sdk";
import { withServerBoingClientFailover } from "@/lib/server-boing-client";
import {
  listLinkedCompanionsForAsset,
  resolveLinkedNftTokenRegistryId,
  type LinkedCompanionPeer,
  type LinkedManagedLink,
} from "@/lib/linked-nft-token-registry";
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

export type CompanionsApiResponse = {
  supported: true;
  network: NetworkId;
  address: string;
  registryId: string | null;
  registrySource: string | null;
  slotCount: number;
  companions: LinkedCompanionPeer[];
  /** Links whose assets this AccountId claims (wallet pages; links are keyed by asset). */
  managedLinks: LinkedManagedLink[];
  rpcHost: string;
  note?: string;
};

/**
 * GET /api/asset/companions?network=testnet&id=0x…
 * Read-only scan of the linked NFT↔token registry for peers of this AccountId.
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
    return NextResponse.json({ error: "Missing id (32-byte hex account / asset)" }, { status: 400 });
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

  try {
    const body = await withServerBoingClientFailover(network, async (client) => {
      let endUser: Record<string, unknown> | null = null;
      try {
        const info = await client.getNetworkInfo();
        endUser =
          info?.end_user && typeof info.end_user === "object"
            ? (info.end_user as unknown as Record<string, unknown>)
            : null;
      } catch {
        endUser = null;
      }

      const { registryId, source } = resolveLinkedNftTokenRegistryId({ network, endUser });
      const rpcHost = rpcHostLabel(network);

      if (!registryId) {
        const empty: CompanionsApiResponse = {
          supported: true,
          network,
          address: idPrefixed.toLowerCase(),
          registryId: null,
          registrySource: null,
          slotCount: 0,
          companions: [],
          managedLinks: [],
          rpcHost,
          note:
            "No linked NFT↔token registry AccountId for this network. Set NEXT_PUBLIC_BOING_LINKED_NFT_TOKEN_REGISTRY or wait for end_user.canonical_linked_nft_token_registry.",
        };
        return empty;
      }

      const { companions, managedLinks, slotCount } = await listLinkedCompanionsForAsset({
        client,
        registryId,
        assetId: idPrefixed,
      });

      const result: CompanionsApiResponse = {
        supported: true,
        network,
        address: idPrefixed.toLowerCase(),
        registryId,
        registrySource: source,
        slotCount,
        companions,
        managedLinks,
        rpcHost,
        note:
          companions.length === 0 && managedLinks.length === 0
            ? "No active companion links for this AccountId in the on-chain registry (tombstones skipped)."
            : undefined,
      };
      return result;
    });

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Companions lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
