/**
 * Content-Security-Policy builder used by `src/middleware.ts`.
 *
 * Modes (env BOING_OBSERVER_CSP):
 *  - "nonce-enforce" (default): nonce + 'strict-dynamic' script-src, ENFORCED. Requires every page to be rendered
 *                           per request (root layout `export const dynamic = "force-dynamic"`), because Next
 *                           cannot add a per-request nonce to HTML prerendered at build time.
 *  - "nonce-report-only"  : the same policy as Report-Only (staging / debugging a violation).
 *  - "report-only"        : ROLLBACK switch. Report-Only policy that allows inline scripts
 *                           (script-src 'self' 'unsafe-inline'); blocks nothing, reports go to /api/csp-report.
 *                           The pages stay dynamic; only the middleware policy is relaxed.
 *  - "off"                : no CSP from middleware (static baseline in security-headers.mjs still applies).
 */

export type CspMode = "off" | "report-only" | "nonce-report-only" | "nonce-enforce";

export function parseCspMode(v: string | undefined): CspMode {
  const m = (v ?? "").trim().toLowerCase();
  if (m === "off" || m === "0" || m === "false") return "off";
  if (m === "report-only" || m === "nonce-report-only") return m;
  return "nonce-enforce"; // default, including unset and unrecognised values (fail closed, not open)
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Directives shared by every mode. NFT media/images may come from any https host; RPC goes via /api/rpc. */
const COMMON_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

export function buildCsp(mode: CspMode, nonce: string): string | null {
  if (mode === "off") return null;
  const script =
    mode === "report-only"
      ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`;
  return [...COMMON_DIRECTIVES, script, "report-uri /api/csp-report"].join("; ");
}

export function cspHeaderName(mode: CspMode): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" | null {
  if (mode === "off") return null;
  return mode === "nonce-enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}