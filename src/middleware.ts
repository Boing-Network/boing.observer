import { NextResponse, type NextRequest } from "next/server";
import { applyRateLimit, rateLimitConfigFromEnv } from "@/lib/rate-limit";
import { buildCsp, cspHeaderName, generateNonce, parseCspMode } from "@/lib/csp";

/**
 * Edge middleware: (1) app-level rate limiting for /api/*, (2) nonce/Report-Only CSP for pages.
 * Must stay edge-runtime safe (no Node APIs). See docs/OPERATIONS.md for tuning and bindings.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const rl = await applyRateLimit(pathname, req.headers, rateLimitConfigFromEnv(process.env));
    if (rl && !rl.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${rl.retryAfterSec} seconds.`, code: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfterSec),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": "0",
            "Cache-Control": "no-store",
          },
        }
      );
    }
    const res = NextResponse.next();
    if (rl) {
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    }
    return res;
  }

  const mode = parseCspMode(process.env.BOING_OBSERVER_CSP);
  const name = cspHeaderName(mode);
  if (!name) return NextResponse.next();

  const nonce = generateNonce();
  const csp = buildCsp(mode, nonce)!;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce from the request CSP header and stamps its own inline scripts on dynamic renders.
  requestHeaders.set(name, csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(name, csp);
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    // Pages only: skip build assets and public static files.
    "/((?!api/|_next/static|_next/image|favicon.ico|pdfs/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|json|txt|xml|pdf|js|css|woff2?)$).*)",
  ],
};