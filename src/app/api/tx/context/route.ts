import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError } from "@boing-network/boing-sdk";
import { CANONICAL_TESTNET_CONTRACTS } from "@/lib/contract-identify";
import { resolveContractInterface } from "@/lib/contract-interface-resolve";
import { resolveNativeDexFactoryForExplorer } from "@/lib/resolve-native-dex-factory";
import { createServerBoingClient } from "@/lib/server-boing-client";
import { isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64, type NetworkId } from "@/lib/rpc-types";
import type { PoolMeta, TokenMeta } from "@/lib/tx-decode";

export const runtime = "nodejs";
export const maxDuration = 60;

export type TxContextResponse = {
  contract: { id: string; interfaceId: string | null; label: string | null; isPool: boolean } | null;
  tokens: Record<string, TokenMeta>;
  pools: Record<string, PoolMeta>;
  labels: Record<string, string>;
};

const MAX_IDS = 24;
const DIRECTORY_TTL_MS = 60_000;
const DIRECTORY_MIN_REFRESH_MS = 15_000;
const MAX_PAGES = 5;

type Directory = { at: number; pools: Record<string, PoolMeta>; tokens: Record<string, TokenMeta> };
const directories = new Map<string, Directory>();

function h64(v: string): string {
  return normalizeHex64(v.trim());
}

async function loadDirectory(network: NetworkId): Promise<Directory> {
  const client = createServerBoingClient(network);
  const factory = await resolveNativeDexFactoryForExplorer(client);
  const dir: Directory = { at: Date.now(), pools: {}, tokens: {} };
  if (!factory) return dir;
  let cursor: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await client.listDexPoolsPage({ factory, cursor, limit: 200, light: true });
    for (const p of page.pools) {
      const id = h64(p.poolHex);
      const a = h64(p.tokenAHex);
      const b = h64(p.tokenBHex);
      if (id && a && b) dir.pools[id] = { tokenA: a, tokenB: b, feeBps: typeof p.feeBps === "number" ? p.feeBps : null };
    }
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  cursor = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await client.listDexTokensPage({ factory, cursor, limit: 200 });
    for (const t of page.tokens) {
      const id = h64(t.id);
      if (!id) continue;
      // Pool-only placeholders ("Pool token 0x…") carry no real name; keep decimals only.
      const abbrev = t.metadataSource === "abbrev";
      dir.tokens[id] = {
        symbol: abbrev ? null : t.symbol || null,
        name: abbrev ? null : t.name || null,
        decimals: typeof t.decimals === "number" ? t.decimals : null,
      };
    }
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return dir;
}

async function getDirectory(network: NetworkId, needIds: string[]): Promise<Directory> {
  const key = network;
  const hit = directories.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  const missing = hit ? needIds.some((id) => !hit.pools[id] && !hit.tokens[id]) : true;
  if (hit && age < DIRECTORY_TTL_MS && !(missing && age > DIRECTORY_MIN_REFRESH_MS)) return hit;
  try {
    const fresh = await loadDirectory(network);
    directories.set(key, fresh);
    return fresh;
  } catch (e) {
    if (hit) return hit; // stale beats nothing
    throw e;
  }
}

/**
 * Names, decimals, pool pairs/fees and interface for the addresses a transaction mentions, so the explorer can
 * describe a contract call ("Swapped 2,398 BOING for 2,464 USDC"). Read-only; derived from the DEX directory RPCs
 * and the same contract identification as `/api/contract/interface`.
 */
export async function GET(req: NextRequest) {
  const n = req.nextUrl.searchParams.get("network");
  const network: NetworkId | null = n === "testnet" || n === "mainnet" ? n : null;
  if (!network) return NextResponse.json({ error: "Invalid or missing network" }, { status: 400 });
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }
  const contractParam = req.nextUrl.searchParams.get("contract");
  const contract = contractParam ? h64(contractParam) : "";
  if (contractParam && !contract) return NextResponse.json({ error: "Invalid contract (expect 32-byte hex)" }, { status: 400 });
  const ids = Array.from(
    new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => h64(s)).filter(Boolean)),
  ).slice(0, MAX_IDS);

  const out: TxContextResponse = { contract: null, tokens: {}, pools: {}, labels: {} };
  const canonical = network === "testnet" ? CANONICAL_TESTNET_CONTRACTS : {};
  const want = contract ? [...ids, contract] : ids;
  for (const id of want) {
    const c = canonical[id];
    if (c) out.labels[id] = c.label;
  }

  try {
    const dir = await getDirectory(network, want);
    const addToken = (id: string) => {
      const m = dir.tokens[id];
      if (m) out.tokens[id] = m;
    };
    for (const id of want) {
      const pool = dir.pools[id];
      if (pool) {
        out.pools[id] = pool;
        addToken(pool.tokenA);
        addToken(pool.tokenB);
      }
      addToken(id);
    }
    if (contract) {
      const known = canonical[contract];
      if (known) {
        out.contract = { id: contract, interfaceId: known.interfaceId, label: known.label, isPool: known.interfaceId.startsWith("pool-") };
      } else if (dir.pools[contract]) {
        out.contract = { id: contract, interfaceId: null, label: null, isPool: true };
      } else {
        const r = await resolveContractInterface(network, contract);
        out.contract = { id: contract, interfaceId: r.interfaceId, label: r.label, isPool: !!r.interfaceId?.startsWith("pool-") };
        if (r.label) out.labels[contract] = r.label;
      }
    }
  } catch (e) {
    const message = e instanceof BoingRpcError ? `${e.message} (RPC ${e.method ?? "?"})` : e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json(out, { headers: { "cache-control": "public, max-age=30" } });
}
