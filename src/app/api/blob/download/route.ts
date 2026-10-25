import { NextRequest, NextResponse } from "next/server";
import { readTextCapped } from "@/lib/bounded-body";
import { HOSTED_TESTNET_RPC_FALLBACKS, getRpcBaseUrl, isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

export const maxDuration = 120;

/** Soft cap for responses proxied through the Cloudflare Worker (memory-safe). */
const MAX_PROXY_BYTES = 48 * 1_048_576; // 48 MiB

function parseNetwork(v: string | null): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

function downloadRpcBase(network: NetworkId): string {
  const override = process.env.BOING_BLOB_DOWNLOAD_RPC?.trim().replace(/\/$/, "");
  if (override) return override;
  // Bypass public gateway 6 MiB cap — hit the producing validator / Fly origin directly.
  if (network === "testnet") return HOSTED_TESTNET_RPC_FALLBACKS[0];
  return getRpcBaseUrl(network);
}

function configuredDownloadTokens(): string[] {
  const out: string[] = [];
  const operator = process.env.BOING_OPERATOR_RPC_TOKEN?.trim();
  if (operator) out.push(operator);
  const extra = process.env.BOING_BLOB_DOWNLOAD_TOKENS?.trim() ?? "";
  for (const part of extra.split(",")) {
    const t = part.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function presentedToken(req: NextRequest): string | null {
  const downloadHdr = req.headers.get("x-boing-blob-download")?.trim();
  if (downloadHdr) return downloadHdr;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  // Do not treat Phase 34 proof bearer as an operator token.
  if (bearer && !bearer.startsWith("boing-blob")) return bearer;
  const q = req.nextUrl.searchParams.get("token")?.trim();
  if (q) return q;
  return null;
}

/** Phase 34 wallet proof headers (forwarded upstream as-is). */
function presentedProofHeaders(req: NextRequest): Record<string, string> | null {
  const downloader = req.headers.get("x-boing-blob-downloader")?.trim();
  const expires = req.headers.get("x-boing-blob-expires")?.trim();
  const nonce = req.headers.get("x-boing-blob-nonce")?.trim();
  const signature = req.headers.get("x-boing-blob-signature")?.trim();
  if (!downloader || !expires || !nonce || !signature) return null;
  return {
    "X-Boing-Blob-Downloader": downloader,
    "X-Boing-Blob-Expires": expires,
    "X-Boing-Blob-Nonce": nonce,
    "X-Boing-Blob-Signature": signature,
  };
}

function upstreamAuthHeaders(
  tokens: string[],
  presented: string | null,
  proof: Record<string, string> | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": "boing-observer/blob-download",
  };
  if (proof) {
    Object.assign(headers, proof);
    return headers;
  }
  const operator = process.env.BOING_OPERATOR_RPC_TOKEN?.trim();
  // Prefer server operator secret for upstream; fall back to the validated user token.
  if (operator) {
    headers["X-Boing-Operator"] = operator;
  } else if (presented) {
    headers["X-Boing-Blob-Download"] = presented;
    headers.Authorization = `Bearer ${presented}`;
  }
  void tokens;
  return headers;
}

/**
 * Permission-gated media blob download.
 * - Phase 34: forward wallet proof headers to the node (publisher / ACL grantee).
 * - Break-glass: caller token ∈ `BOING_BLOB_DOWNLOAD_TOKENS` / `BOING_OPERATOR_RPC_TOKEN`,
 *   then upstream with server operator secret when available.
 */
export async function GET(req: NextRequest) {
  const tokens = configuredDownloadTokens();
  const proof = presentedProofHeaders(req);
  const presented = presentedToken(req);

  if (!proof) {
    if (tokens.length === 0) {
      return NextResponse.json(
        {
          error: "Blob download is not configured on this explorer.",
          hint: "Connect a publisher/grantee wallet (Phase 34 proof) or set BOING_BLOB_DOWNLOAD_TOKENS / BOING_OPERATOR_RPC_TOKEN.",
        },
        { status: 503 }
      );
    }
    if (!presented || !tokens.includes(presented)) {
      return NextResponse.json(
        {
          error: "Download permission required.",
          hint: "Use Download with wallet (publisher/grantee), or provide Authorization: Bearer / X-Boing-Blob-Download matching an allowed download token.",
        },
        { status: 401 }
      );
    }
  }

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

  const base = downloadRpcBase(network).replace(/\/$/, "");
  const upstreamUrl = `${base}/v1/media/blob?id=${encodeURIComponent(`0x${blobId}`)}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamAuthHeaders(tokens, presented, proof),
      signal: AbortSignal.timeout(110_000),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Blob download RPC unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    let detail = `Upstream HTTP ${upstream.status}`;
    try {
      const text = await readTextCapped(upstream, 16_384);
      if (text) {
        try {
          const j = JSON.parse(text) as { error?: string; hint?: string };
          detail = j.error || detail;
          return NextResponse.json(
            { error: detail, hint: j.hint, upstreamStatus: upstream.status },
            { status: upstream.status === 401 || upstream.status === 403 ? 401 : upstream.status === 404 ? 404 : 502 }
          );
        } catch {
          detail = text.slice(0, 240);
        }
      }
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: detail, upstreamStatus: upstream.status }, { status: 502 });
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  if (contentLength > MAX_PROXY_BYTES) {
    return NextResponse.json(
      {
        error: `Blob is too large to proxy through the explorer (${contentLength} bytes; max ${MAX_PROXY_BYTES}).`,
        hint: "Download directly from the validator with GET /v1/media/blob?id=… and a wallet proof or operator token.",
        blobId: `0x${blobId}`,
      },
      { status: 413 }
    );
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const disposition =
    upstream.headers.get("content-disposition") ||
    `attachment; filename="boing-blob-${blobId.slice(0, 8)}.bin"`;

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "X-Boing-Blob-Id": `0x${blobId}`,
  });
  const sizeHdr = upstream.headers.get("x-boing-blob-size");
  if (sizeHdr) headers.set("X-Boing-Blob-Size", sizeHdr);
  const pubHdr = upstream.headers.get("x-boing-blob-publisher");
  if (pubHdr) headers.set("X-Boing-Blob-Publisher", pubHdr);
  if (contentLength > 0) headers.set("Content-Length", String(contentLength));

  if (upstream.body) {
    return new NextResponse(upstream.body, { status: 200, headers });
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_PROXY_BYTES) {
    return NextResponse.json(
      { error: `Blob is too large to proxy through the explorer (${buf.byteLength} bytes).` },
      { status: 413 }
    );
  }
  return new NextResponse(buf, { status: 200, headers });
}
