/**
 * Content-Security-Policy builder used by `src/middleware.ts`.
 *
 * Modes (env BOING_OBSERVER_CSP):
 *  - "off"                : no CSP from middleware (static baseline in security-headers.mjs still applies).
 *  - "report-only" (default): Report-Only policy that matches the current static-prerendered pages
 *                           (script-src 'self' 'unsafe-inline'). Surfaces connect/img/frame/etc. violations
 *                           without blocking anything; reports go to /api/csp-report.
 *  - "nonce-report-only"  : nonce + 'strict-dynamic' script-src, Report-Only. Only meaningful for
 *                           dynamically rendered routes, because Next cannot add a per-request nonce to HTML
 *                           that was prerendered at build time (about, dex/*, faucet, qa/*, tools/*, tokens, /).
 *  - "nonce-enforce"      : same policy, enforced. Do NOT enable until every route is dynamic
 *                           (root layout `export const dynamic = "force-dynamic"`) and reports are clean.
 */

export type CspMode = "off" | "report-only" | "nonce-report-only" | "nonce-enforce";

export function parseCspMode(v: string | undefined): CspMode {
  const m = (v ?? "report-only").trim().toLowerCase();
  if (m === "off" || m === "0" || m === "false") return "off";
  if (m === "nonce-report-only" || m === "nonce-enforce") return m;
  return "report-only";
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