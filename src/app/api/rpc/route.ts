import { NextRequest, NextResponse } from "next/server";
import { getRpcBaseUrl } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

function isValidNetwork(v: string | null): v is NetworkId {
  return v === "testnet" || v === "mainnet";
}

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

  let upstreamBase: string;
  try {
    upstreamBase = getRpcBaseUrl(network);
  } catch (e) {
    const message = e instanceof Error ? e.message : "RPC not configured";
    return NextResponse.json({ error: message }, { status: 400 });
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

  const upstreamUrl = upstreamBase.endsWith("/") ? upstreamBase : `${upstreamBase}/`;

  const reqId =
    typeof (body as { id?: unknown }).id === "number" ? (body as { id: number }).id : 0;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();

    // Upstream often returns 530 + plain text (e.g. Cloudflare tunnel error 1033). Forwarding
    // that status breaks the browser client (non-OK + non-JSON). Map to JSON-RPC error over HTTP 200.
    if (!upstream.ok) {
      const tunnelHint =
        upstream.status === 530 || /\b1033\b/i.test(text)
          ? " Tunnel or origin is likely down—verify the node and Cloudflare Tunnel for the public RPC hostname."
          : "";
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: reqId,
          error: {
            code: -32_000,
            message: `Boing RPC endpoint returned HTTP ${upstream.status}.${tunnelHint}`.trim(),
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
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: reqId,
        error: { code: -32_000, message: "Upstream RPC unreachable (network error from proxy)." },
      },
      { status: 200 }
    );
  }
}
