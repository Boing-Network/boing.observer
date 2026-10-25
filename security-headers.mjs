/**
 * Baseline security headers for every dynamic response (static assets get the same via `public/_headers`).
 * A full script-src CSP is intentionally not set here: Next inlines bootstrap + JSON-LD scripts and NFT media
 * come from arbitrary https hosts, so a strict policy needs nonces (tracked in HANDOFF.md). These directives
 * are safe with the current app and close clickjacking / base-tag / plugin / form-hijack vectors.
 */
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'",
  },
];

/** Same-origin PDF embeds on /about override the global framing rules. */
export const PDF_HEADERS = [
  { key: "Content-Type", value: "application/pdf" },
  { key: "Content-Disposition", value: "inline" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
];
