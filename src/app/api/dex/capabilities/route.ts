import { NextResponse } from "next/server";
import { dexDiagnosticsEnabled } from "@/lib/server-dex-factory";

/** Lets the UI show an ops-only diagnostics toggle when the deployer enables it server-side. */
export async function GET() {
  return NextResponse.json({ diagnosticsAllowed: dexDiagnosticsEnabled() });
}
