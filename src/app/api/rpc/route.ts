import { NextRequest, NextResponse } from "next/server";
import { getRpcBaseUrl, getTestnetRpcCandidates } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

function isValidNetwork(v: string | null): v is NetworkId {
  return v === "testnet" || v === "mainnet";
}

/** Methods the explorer browser client may invoke via the same-origin proxy. */
const ALLOWED_RPC_METHODS = new Set([
  "boing_chainHeight",
  "boing_getSyncState",
  "boing_health",
  "boing_getBlockByHeight",
  "boing_getBlockByHash",
  "boing_getTransactionReceipt",
  "boing_getAccount",
  "boing_getNetworkInfo",
  "boing_getContractStorage",
  "boing_getQaRegistry",
  "boing_qaPoolList",
  "boing_qaPoolConfig",
  "boing_getRpcMethodCatalog",
  "boing_qaCheck",
  "boing_faucetRequest",
]);

const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 1_048_576; // 1 MiB (qaCheck bytecode payloads)

/**
 * Same-origin JSON-RPC proxy so the browser never calls the Boing node directly.
 * Avoids CORS/preflight failures when the tunnel or an intermediary strips
 * Access-Control-* on OPTIONS or errors.
 */
export async function POST(req: NextRequest) {
  const network = req.headers.get("x-boing-rpc-network");
  if (!isValidNetwork(network)) {
    return NextResponse.json(
      { error: "Missing or invalid X-Boing-RPC-Network (testnet | mainnet)" },
      { status: 400 }
    );
  }

  let upstreamBases: string[];
  try {
    upstreamBases =
      network === "testnet" ? getTestnetRpcCandidates() : [getRpcBaseUrl(network)];
  } catch (e) {
    const message = e instanceof Error ? e.message : "RPC not configured";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    body === null ||
    typeof body !== "object" ||
    (body as { jsonrpc?: unknown }).jsonrpc !== "2.0" ||
    typeof (body as { method?: unknown }).method !== "string"
  ) {
    return NextResponse.json({ error: "Invalid JSON-RPC 2.0 request" }, { status: 400 });
  }

  const method = (body as { method: string }).method;
  const reqId =
    typeof (body as { id?: unknown }).id === "number" ? (body as { id: number }).id : 0;

  if (!ALLOWED_RPC_METHODS.has(method)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: reqId,
        error: { code: -32_601, message: `Method not allowed via explorer proxy: ${method}` },
      },
      { status: 200 }
    );
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const failoverStatuses = new Set([502, 503, 504, 521, 522, 523, 524, 525, 526, 530]);
  let lastStatus = 0;
  let lastText = "";
  let lastError = "";

  for (let i = 0; i < upstreamBases.length; i += 1) {
    const upstreamBase = upstreamBases[i];
    const upstreamUrl = upstreamBase.endsWith("/") ? upstreamBase : `${upstreamBase}/`;
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "boing-observer/rpc-proxy",
        },
        body: serialized,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      const text = await upstream.text();

      if (!upstream.ok && failoverStatuses.has(upstream.status) && i < upstreamBases.length - 1) {
        lastStatus = upstream.status;
        lastText = text;
        continue;
      }

      // Upstream 5xx/530 + plain text (e.g. Cloudflare tunnel error 1033) must not be
      // forwarded as a non-JSON HTTP error — the browser client expects JSON-RPC.
      if (!upstream.ok) {
        const edgeHint =
          upstream.status === 530 || /\b1033\b/i.test(text)
            ? " Public hostname did not reach a hosted node—verify Fly backends and the RPC gateway."
            : "";
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32_000,
              message: `Boing RPC endpoint returned HTTP ${upstream.status}.${edgeHint}`.trim(),
            },
          },
          { status: 200 }
        );
      }

      const ct = upstream.headers.get("Content-Type") ?? "application/json";
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": ct },
      });
    } catch (e) {
      const timedOut =
        e instanceof Error &&
        (e.name === "TimeoutError" || e.name === "AbortError" || /aborted|timeout/i.test(e.message));
      lastError = timedOut
        ? `Upstream RPC timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s.`
        : "Upstream RPC unreachable (network error from proxy).";
      if (i < upstreamBases.length - 1) continue;
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: reqId,
          error: { code: -32_000, message: lastError },
        },
        { status: 200 }
      );
    }
  }

  const tunnelHint =
    lastStatus === 530 || /\b1033\b/i.test(lastText)
      ? " Public hostname did not reach a hosted node—verify Fly backends and the RPC gateway."
      : "";
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: reqId,
      error: {
        code: -32_000,
        message: lastError
          ? lastError
          : `Boing RPC endpoint returned HTTP ${lastStatus || 502}.${tunnelHint}`.trim(),
      },
    },
    { status: 200 }
  );
}
