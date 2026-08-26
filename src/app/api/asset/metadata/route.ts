import { NextRequest, NextResponse } from "next/server";
import { resolveOffchainTokenMetadata } from "@/lib/token-metadata-lookup";

export const runtime = "nodejs";

/** Look up off-chain launch metadata JSON by on-chain `description_hash`. */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  const found = await resolveOffchainTokenMetadata(hash);
  if (!found) {
    return NextResponse.json({ found: false as const });
  }
  return NextResponse.json({ found: true as const, ...found });
}
