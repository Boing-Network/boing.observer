import { NextRequest, NextResponse } from "next/server";
import { HOSTED_TESTNET_RPC_FALLBACKS, getRpcBaseUrl, isMainnetConfigured } from "@/lib/rpc-client";
import {
  isAccountHex,
  normalizeSignedTxHex,
  normalizeVoterHex,
  qaPoolVoteRpcParams,
} from "@/lib/qa-reviewer-auth";
import { normalizeHex64 } from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

const VOTES = new Set(["allow", "reject", "abstain"]);

type VoteBody = {
  network?: string;
  voterHex?: string;
  txHash?: string;
  vote?: string;
  signedTxHex?: string;
};

function parseNetwork(v: unknown): NetworkId | null {
  if (v === "testnet" || v === "mainnet") return v;
  return null;
}

function voteRpcUrl(network: NetworkId): string {
  const override = process.env.BOING_QA_VOTE_RPC?.trim().replace(/\/$/, "");
  if (override) return override;
  // Pool state is in-memory on the producing validator. Do not fail over to a full node.
  if (network === "testnet") return HOSTED_TESTNET_RPC_FALLBACKS[0];
  return getRpcBaseUrl(network);
}

/**
 * Public proxy for `boing_qaPoolVote`.
 * Browser never sees `BOING_OPERATOR_RPC_TOKEN`.
 * With a signed `QaPoolVote` hex (4th RPC param), public-membership nodes accept the vote
 * and inclusion can pay treasury rewards. Unsigned 3-param votes do not pay.
 */
export async function POST(req: NextRequest) {
  let body: VoteBody;
  try {
    body = (await req.json()) as VoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const network = parseNetwork(body.network);
  if (!network) {
    return NextResponse.json({ error: "Invalid network" }, { status: 400 });
  }
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }

  const voterHex = normalizeVoterHex(typeof body.voterHex === "string" ? body.voterHex : "");
  if (!isAccountHex(voterHex)) {
    return NextResponse.json(
      { error: "Voter must be a 32-byte account id (64 hex chars)." },
      { status: 400 }
    );
  }

  const txHash = normalizeHex64(typeof body.txHash === "string" ? body.txHash : "");
  if (!txHash) {
    return NextResponse.json({ error: "Invalid transaction hash." }, { status: 400 });
  }

  const vote = typeof body.vote === "string" ? body.vote.trim().toLowerCase() : "";
  if (!VOTES.has(vote)) {
    return NextResponse.json({ error: "Vote must be allow, reject, or abstain." }, { status: 400 });
  }

  let signedTxHex: string | null = null;
  if (typeof body.signedTxHex === "string" && body.signedTxHex.trim()) {
    signedTxHex = normalizeSignedTxHex(body.signedTxHex);
    if (!signedTxHex) {
      return NextResponse.json({ error: "signedTxHex must be even-length hex of a signed QaPoolVote." }, { status: 400 });
    }
  }

  const operatorToken = process.env.BOING_OPERATOR_RPC_TOKEN?.trim();
  const upstream = voteRpcUrl(network);
  const upstreamUrl = upstream.endsWith("/") ? upstream : `${upstream}/`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "boing-observer/qa-vote",
  };
  if (operatorToken) {
    headers["X-Boing-Operator"] = operatorToken;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "boing_qaPoolVote",
        params: qaPoolVoteRpcParams(txHash, voterHex, vote, signedTxHex),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Vote RPC unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let data: {
    result?: { outcome?: string; mempool?: boolean; duplicate?: boolean; error?: string };
    error?: { code?: number; message?: string };
  };
  try {
    data = (await upstreamRes.json()) as typeof data;
  } catch {
    return NextResponse.json({ error: `Vote RPC HTTP ${upstreamRes.status}` }, { status: 502 });
  }

  if (data.error) {
    return NextResponse.json(
      {
        error: data.error.message || "QA pool vote failed",
        code: data.error.code,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    result: data.result ?? {},
    rewardedPath: Boolean(signedTxHex),
  });
}
