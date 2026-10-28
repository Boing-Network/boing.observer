import { NextRequest, NextResponse } from "next/server";
import { validateHex32 } from "@boing-network/boing-sdk";
import { resolveContractInterface, type ContractInterfaceResponse } from "@/lib/contract-interface-resolve";
import { isMainnetConfigured } from "@/lib/rpc-client";
import { normalizeHex64, type NetworkId } from "@/lib/rpc-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export type { ContractInterfaceResponse };

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
  const value = await resolveContractInterface(network, address64);
  return NextResponse.json(value, { headers: { "cache-control": "public, max-age=300" } });
}
