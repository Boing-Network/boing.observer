import { NextResponse } from "next/server";

/** CSP violation report sink. Logs a compact line (visible in `wrangler tail`) and returns 204. */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 8192) return new NextResponse(null, { status: 413 });
  try {
    const text = (await req.text()).slice(0, 4096);
    console.warn("[csp-report]", text);
  } catch {
    // ignore malformed reports
  }
  return new NextResponse(null, { status: 204 });
}