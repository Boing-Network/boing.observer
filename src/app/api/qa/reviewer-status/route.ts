import { NextResponse } from "next/server";

/**
 * Public: whether the explorer vote proxy is available.
 * Never returns secrets.
 */
export async function GET() {
  const operator = Boolean(process.env.BOING_OPERATOR_RPC_TOKEN?.trim());
  return NextResponse.json({
    configured: true,
    publicVoting: true,
    operatorTokenConfigured: operator,
  });
}
