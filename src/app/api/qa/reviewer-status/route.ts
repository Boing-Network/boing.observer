import { NextResponse } from "next/server";

/**
 * Public: whether the explorer vote proxy is available.
 * Only signed votes (Boing Express) are relayed; see `/api/qa/vote`. Never returns secrets.
 */
export async function GET() {
  return NextResponse.json({
    configured: true,
    publicVoting: true,
    signedVotesOnly: true,
  });
}
