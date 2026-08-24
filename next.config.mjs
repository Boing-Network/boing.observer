/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["boing-sdk", "pdfjs-dist"],
  /** Peer deps of boing-sdk must resolve from app node_modules when the server bundle inlines the SDK. */
  serverExternalPackages: ["@noble/ed25519", "@noble/hashes"],
  async headers() {
    return [
      {
        source: "/pdfs/:path*",
        headers: [
          { key: "Content-Type", value: "application/pdf" },
          { key: "Content-Disposition", value: "inline" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Optional: integrate OpenNext Cloudflare for local dev (bindings, etc.)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
