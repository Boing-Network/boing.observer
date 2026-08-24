import { NextRequest, NextResponse } from "next/server";
import { BoingRpcError } from "boing-sdk";
import { defaultTokenIndexCacheTtlSeconds } from "@/lib/token-index/cache-logic";
import { buildTokenIndexForHeightRange } from "@/lib/token-index/build-token-index";
import {
  assembleTokenIndexCacheMeta,
  readTokenIndexDiskCache,
  resolveTokenIndexCacheDir,
  writeTokenIndexDiskCache,
} from "@/lib/token-index/file-cache-store";
import { isMainnetConfigured } from "@/lib/rpc-client";
import { createServerBoingClient } from "@/lib/server-boing-client";
import type { NetworkId } from "@/lib/rpc-types";

export const maxDuration = 120;
/** Node filesystem cache; explicit so route is not bundled for Edge (no `node:fs`). */
export const runtime = "nodejs";

const MAX_BLOCKS_PER_REQUEST = 2048;

const INDEX_NOTE =
  "Snapshots merge included contract deploys (return_data when present, otherwise CREATE2 / nonce-derived AccountId matching the node) and native DEX register_pair tokens when a live canonical factory is published. A finance Deploy submitted toast is mempool accept, not explorer listing. Durable copies are written under TOKEN_INDEX_CACHE_DIR (default .cache/token-index) with TTL — use ?refresh=1 to force a new RPC scan. This is not OBS-1: pruned nodes and receipt gaps can still miss assets.";

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

/**
 * Token / asset index with optional on-disk cache between requests.
 *
 * Query: `network` (required), `window` or `fromHeight`+`toHeight`, `refresh=1` to bypass cache.
 */
export async function GET(req: NextRequest) {
  const network = parseNetwork(req.nextUrl.searchParams.get("network"));
  if (!network) {
    return NextResponse.json({ error: "Invalid or missing network (testnet | mainnet)" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const refresh =
    req.nextUrl.searchParams.get("refresh") === "1" || req.nextUrl.searchParams.get("refresh") === "true";
  const fromParam = req.nextUrl.searchParams.get("fromHeight");
  const toParam = req.nextUrl.searchParams.get("toHeight");
  const windowParam = req.nextUrl.searchParams.get("window");

  const ttlSeconds = defaultTokenIndexCacheTtlSeconds();
  const cacheBackend = resolveTokenIndexCacheDir() != null ? "file" : "none";

  try {
    const client = createServerBoingClient(network);
    const info = await client.getNetworkInfo();
    const currentHead = info.head_height;

    let fromHeight: number;
    let toHeight: number;

    if (fromParam != null && toParam != null) {
      fromHeight = parseInt(fromParam, 10);
      toHeight = parseInt(toParam, 10);
      if (!Number.isInteger(fromHeight) || !Number.isInteger(toHeight)) {
        return NextResponse.json({ error: "fromHeight and toHeight must be integers" }, { status: 400 });
      }
      if (fromHeight < 0 || toHeight < fromHeight || toHeight > currentHead) {
        return NextResponse.json(
          { error: "Invalid range (need 0 ≤ fromHeight ≤ toHeight ≤ head)" },
          { status: 400 },
        );
      }
      const span = toHeight - fromHeight + 1;
      if (span > MAX_BLOCKS_PER_REQUEST) {
        return NextResponse.json(
          {
            error: `Range too large (${span} blocks). Max ${MAX_BLOCKS_PER_REQUEST} blocks per request — paginate with fromHeight/toHeight.`,
          },
          { status: 400 },
        );
      }
    } else {
      let window = parseInt(windowParam ?? "512", 10);
      if (!Number.isFinite(window) || window < 1) window = 512;
      window = Math.min(window, MAX_BLOCKS_PER_REQUEST);
      toHeight = currentHead;
      fromHeight = Math.max(0, toHeight - window + 1);
    }

    if (!refresh && cacheBackend === "file") {
      const disk = await readTokenIndexDiskCache(network, fromHeight, toHeight);
      if (disk.ok) {
        const e = disk.envelope;
        return NextResponse.json({
          ...e.result,
          note: e.note,
          cacheMeta: assembleTokenIndexCacheMeta({
            backend: "file",
            hit: true,
            rpcRefreshed: false,
            ttlSeconds: e.ttlSeconds,
            savedAt: e.savedAt,
            headWhenBuilt: e.headHeightWhenBuilt,
            currentHead,
            scannedToHeight: e.toHeight,
            snapshotPersisted: true,
          }),
        });
      }
    }

    const result = await buildTokenIndexForHeightRange(client, fromHeight, toHeight);
    const headWhenBuilt = result.headHeight;

    const savedAt = new Date().toISOString();
    let persisted = false;
    if (cacheBackend === "file") {
      persisted = await writeTokenIndexDiskCache({
        network,
        fromHeight,
        toHeight,
        savedAt,
        ttlSeconds,
        headHeightWhenBuilt: headWhenBuilt,
        note: INDEX_NOTE,
        result,
      });
    }

    return NextResponse.json({
      ...result,
      note: INDEX_NOTE,
      cacheMeta: assembleTokenIndexCacheMeta({
        backend: cacheBackend,
        hit: false,
        rpcRefreshed: true,
        ttlSeconds,
        savedAt: persisted ? savedAt : null,
        headWhenBuilt,
        currentHead,
        scannedToHeight: toHeight,
        snapshotPersisted: cacheBackend === "file" ? persisted : null,
      }),
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
