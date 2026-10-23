import { NextRequest, NextResponse } from "next/server";
import { CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX, validateHex32 } from "@boing-network/boing-sdk";
import { resolveContractCode, type ContractCodeLookup } from "@/lib/contract-code-lookup";
import { applyPublishedInterface, identifyContract, type IdentifiedContract, type PublishedInfo } from "@/lib/contract-identify";
import { resolvePublishedInterface } from "@/lib/published-interface";
import { getRpcBaseUrl, isMainnetConfigured, rpcCall } from "@/lib/rpc-client";
import { normalizeHex64, type NetworkId } from "@/lib/rpc-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export type ContractInterfaceResponse = IdentifiedContract & {
  calledAsContract: boolean;
  callCount: number;
  historyUnsupported?: boolean;
  published?: PublishedInfo;
};

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: ContractInterfaceResponse }>();

export async function GET(req: NextRequest) {
  const n = req.nextUrl.searchParams.get("network");
  const network: NetworkId | null = n === "testnet" || n === "mainnet" ? n : null;
  if (!network) return NextResponse.json({ error: "Invalid or missing network" }, { status: 400 });
  if (network === "mainnet" && !isMainnetConfigured()) {
    return NextResponse.json({ error: "Mainnet RPC is not configured." }, { status: 400 });
  }
  let address64: string;
  try {
    address64 = normalizeHex64(validateHex32(req.nextUrl.searchParams.get("id") ?? "").replace(/^0x/i, ""));
  } catch {
    return NextResponse.json({ error: "Invalid id (expect 32-byte hex)" }, { status: 400 });
  }
  const key = `${network}:${address64}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.value);

  const base = getRpcBaseUrl(network);
  const rpc = <T,>(method: string, params: unknown[]) => rpcCall<T>(network, base, method, params);
  let lookup: ContractCodeLookup;
  try {
    lookup = await resolveContractCode(rpc, address64, {
      extraDeployers: network === "testnet" ? [CANONICAL_BOING_TESTNET_NATIVE_DEX_DEPLOYER_HEX] : [],
    });
  } catch {
    lookup = { calledAsContract: false, callCount: 0, code: null };
  }
  let published: Awaited<ReturnType<typeof resolvePublishedInterface>> = null;
  if (network === "testnet") {
    try {
      published = await resolvePublishedInterface(rpc, address64, { knownDeployer: lookup.code?.deployer ?? null });
    } catch {
      published = null;
    }
  }
  const value: ContractInterfaceResponse = {
    ...applyPublishedInterface(identifyContract({ network, address64, code: lookup.code }), published),
    calledAsContract: lookup.calledAsContract,
    callCount: lookup.callCount,
    ...(lookup.historyUnsupported ? { historyUnsupported: true } : {}),
  };
  cache.set(key, { at: Date.now(), value });
  return NextResponse.json(value, { headers: { "cache-control": "public, max-age=300" } });
}