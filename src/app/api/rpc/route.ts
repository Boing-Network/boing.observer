import { NextRequest, NextResponse } from "next/server";
import { getRpcBaseUrl, getTestnetRpcCandidates } from "@/lib/rpc-client";
import { validateProxyRequest } from "@/lib/rpc-proxy-policy";
import type { NetworkId } from "@/lib/rpc-types";

function isValidNetwork(v: string | null): v is NetworkId {
  return v === "testnet" || v === "mainnet";
}

const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 1_048_576; // 1 MiB (qaCheck bytecode payloads)
/**
 * Cap upstream response bodies. Tip blocks with large ContractDeploy bytecode can be
 * multi‑MB to hundreds of MB as JSON number arrays; edge proxies often truncate those
 * mid-array and still return HTTP 200 — which surfaces in the UI as
 * `Expected ',' or ']' after array element in JSON at position …`.
 */
const MAX_RESPONSE_BYTES = 6 * 1_048_576; // 6 MiB

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

  // Read as text so the cap is enforced on bytes even for chunked bodies without Content-Length.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const checked = validateProxyRequest(body);
  if (!checked.ok) {
    if (checked.kind === "method_not_allowed") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: checked.id,
          error: { code: -32_601, message: `Method not allowed via explorer proxy: ${checked.method}` },
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  const reqId = checked.request.id;
  const serialized = JSON.stringify(checked.request);

  // 403: CF Bot Fight / challenge HTML on the public hostname (not a JSON-RPC body).
  const failoverStatuses = new Set([403, 502, 503, 504, 521, 522, 523, 524, 525, 526, 530]);
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

      const declaredLength = Number(upstream.headers.get("content-length") ?? "NaN");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        await upstream.body?.cancel().catch(() => undefined);
        // Oversized block bodies are not failover-worthy — every backend returns the same block.
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32_000,
              message: `Upstream RPC response too large (${declaredLength} bytes; limit ${MAX_RESPONSE_BYTES}). Often a block with large deploy bytecode — try a specific height or upgrade the node to hex-encode bytecode.`,
            },
          },
          { status: 200 }
        );
      }

      const buf = await upstream.arrayBuffer();
      const text = new TextDecoder().decode(buf);
      const looksLikeCfChallenge =
        upstream.status === 403 &&
        (/cf-mitigated/i.test(upstream.headers.get("cf-mitigated") || "") ||
          /Just a moment/i.test(text) ||
          /challenges\.cloudflare\.com/i.test(text));

      if (
        !upstream.ok &&
        (failoverStatuses.has(upstream.status) || looksLikeCfChallenge) &&
        i < upstreamBases.length - 1
      ) {
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
            : looksLikeCfChallenge || upstream.status === 403
              ? " Public hostname returned a Cloudflare challenge—Bot Fight Mode must stay off for JSON-RPC clients."
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

      if (buf.byteLength > MAX_RESPONSE_BYTES) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32_000,
              message: `Upstream RPC response too large (${buf.byteLength} bytes; limit ${MAX_RESPONSE_BYTES}).`,
            },
          },
          { status: 200 }
        );
      }

      if (
        Number.isFinite(declaredLength) &&
        declaredLength > 0 &&
        buf.byteLength < declaredLength
      ) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32_000,
              message: `Upstream RPC response truncated (${buf.byteLength} of ${declaredLength} bytes). Usually an oversized block cut by a gateway timeout — retry or skip that height.`,
            },
          },
          { status: 200 }
        );
      }

      try {
        JSON.parse(text);
      } catch {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32_000,
              message:
                "Upstream RPC returned truncated or invalid JSON (often a mid-array cut of deploy bytecode). Not forwarding corrupt body.",
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
