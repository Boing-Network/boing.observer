import { NextRequest, NextResponse } from "next/server";
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
  if (bearer) return bearer;
  const q = req.nextUrl.searchParams.get("token")?.trim();
  if (q) return q;
  return null;
}

function upstreamAuthHeaders(tokens: string[], presented: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": "boing-observer/blob-download",
  };
  const operator = process.env.BOING_OPERATOR_RPC_TOKEN?.trim();
  // Prefer server operator secret for upstream; fall back to the validated user token.
  if (operator) {
    headers["X-Boing-Operator"] = operator;
  } else {
    headers["X-Boing-Blob-Download"] = presented;
    headers.Authorization = `Bearer ${presented}`;
  }
  void tokens;
  return headers;
}

/**
 * Permission-gated media blob download.
 * Caller must present a token matching `BOING_BLOB_DOWNLOAD_TOKENS` and/or
 * `BOING_OPERATOR_RPC_TOKEN`. Browser never sees the server operator secret unless
 * that same value is the download credential they already know.
 */
export async function GET(req: NextRequest) {
  const tokens = configuredDownloadTokens();
  if (tokens.length === 0) {
    return NextResponse.json(
      {
        error: "Blob download is not configured on this explorer.",
        hint: "Set BOING_BLOB_DOWNLOAD_TOKENS and/or BOING_OPERATOR_RPC_TOKEN on the observer Worker.",
      },
      { status: 503 }
    );
  }

  const presented = presentedToken(req);
  if (!presented || !tokens.includes(presented)) {
    return NextResponse.json(
      {
        error: "Download permission required.",
        hint: "Provide Authorization: Bearer <token> or X-Boing-Blob-Download matching an allowed download token.",
      },
      { status: 401 }
    );
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
      headers: upstreamAuthHeaders(tokens, presented),
      signal: AbortSignal.timeout(110_000),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Blob download RPC unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    let detail = `Upstream HTTP ${upstream.status}`;
    try {
      const text = await upstream.text();
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
        hint: "Download directly from the validator with GET /v1/media/blob?id=… and your operator/download token.",
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

  // Stream when possible so large bodies do not need a second full buffer in the Worker.
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
