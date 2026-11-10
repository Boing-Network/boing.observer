import { NextRequest, NextResponse } from "next/server";
import { getRpcBaseUrl, rpcCall } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";
import {
  REF_MT_ADMIN_KEY_HEX,
  contractCodeHexFromRpc,
  isReferenceMultiTokenBytecode,
  multiTokenAmountFromStorageWord,
  multiTokenBalanceStorageKey,
  multiTokenMetadataStorageKey,
  multiTokenSupplyStorageKey,
  multiTokenWordFromStorage,
} from "@/lib/reference-multi-token";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Reference multi-token (game items) reads.
 *
 * - `?network=&contract=&itemId=[&account=]` → template check, total supply, type-level metadata hash, admin,
 *   optional live balance of `account`, and holders from the durable index (when configured).
 * - `?network=&owner=` → items the account touched (durable index, request-driven, no cron) with live balances.
 *
 * Balances are always read live from contract storage; the index (nft-owner-indexer `/v1/items/*`) only says
 * which (contract, item, account) pairs ever moved.
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function hex64(raw: string | null): string | null {
  if (!raw) return null;
  const h = raw.trim().replace(/^0x/i, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(h) ? h : null;
}

function itemIdParam(raw: string | null): bigint | null {
  if (!raw || !/^\d{1,20}$/.test(raw.trim())) return null;
  const n = BigInt(raw.trim());
  return n < BigInt(1) << BigInt(64) ? n : null;
}

function indexerBase(): string | null {
  const raw = process.env.NFT_OWNER_INDEXER_URL?.trim() || process.env.BOING_NFT_OWNER_INDEXER_URL?.trim() || "";
  return raw ? raw.replace(/\/+$/, "") : null;
}

async function fromIndexer(path: string): Promise<{ ok: boolean; body: Record<string, unknown> | null; error?: string }> {
  const base = indexerBase();
  if (!base) return { ok: false, body: null, error: "Items index is not configured (NFT_OWNER_INDEXER_URL)" };
  try {
    const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const body = (await res.json()) as Record<string, unknown>;
    return res.ok ? { ok: true, body } : { ok: false, body, error: typeof body.error === "string" ? body.error : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, body: null, error: e instanceof Error ? e.message : "Index unreachable" };
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = sp.get("network") === "mainnet" ? "mainnet" : sp.get("network") === "testnet" ? "testnet" : null;
  if (!network) return json({ error: "Invalid or missing network (testnet | mainnet)" }, 400);
  const net = network as NetworkId;
  const base = getRpcBaseUrl(net);
  const storage = (contract: string, key: string) =>
    rpcCall<unknown>(net, base, "boing_getContractStorage", [`0x${contract}`, `0x${key}`]);

  const owner = hex64(sp.get("owner"));
  if (owner) {
    const r = await fromIndexer(`/v1/items/by-owner?owner=0x${owner}&limit=100`);
    if (!r.ok) return json({ owner, items: [], error: r.error, network }, r.body ? 502 : 503);
    return json({ ...r.body, network, source: "nft-owner-indexer" });
  }

  const contract = hex64(sp.get("contract"));
  const itemId = itemIdParam(sp.get("itemId"));
  if (!contract || itemId == null) {
    return json({ error: "Pass owner=, or contract= (32-byte hex) and itemId= (u64 decimal)" }, 400);
  }
  try {
    const code = await rpcCall<unknown>(net, base, "boing_getContractCode", [`0x${contract}`]);
    const isReference = isReferenceMultiTokenBytecode(contractCodeHexFromRpc(code));
    if (!isReference) {
      return json({ contract, itemId: itemId.toString(), isReference: false, network }, 200);
    }
    const account = hex64(sp.get("account"));
    const [supply, meta, admin, bal] = await Promise.all([
      storage(contract, multiTokenSupplyStorageKey(itemId)),
      storage(contract, multiTokenMetadataStorageKey(itemId)),
      storage(contract, REF_MT_ADMIN_KEY_HEX),
      account ? storage(contract, multiTokenBalanceStorageKey(account, itemId)) : Promise.resolve(null),
    ]);
    const holders = await fromIndexer(`/v1/items/holders?contract=0x${contract}&itemId=${itemId}&limit=50`);
    return json({
      network,
      contract,
      itemId: itemId.toString(),
      isReference: true,
      totalSupply: multiTokenAmountFromStorageWord(supply).toString(),
      metadataHash: multiTokenWordFromStorage(meta),
      admin: multiTokenWordFromStorage(admin),
      account: account ?? null,
      balance: account ? multiTokenAmountFromStorageWord(bal).toString() : null,
      holders: holders.ok ? holders.body?.holders ?? [] : [],
      holdersError: holders.ok ? null : holders.error ?? null,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "RPC error", contract, network }, 502);
  }
}
