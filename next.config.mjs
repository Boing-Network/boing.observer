import { PDF_HEADERS, SECURITY_HEADERS } from "./security-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@boing-network/boing-sdk", "pdfjs-dist"],
  /** Peer deps of @boing-network/boing-sdk must resolve from app node_modules when the server bundle inlines the SDK. */
  serverExternalPackages: ["@noble/ed25519", "@noble/hashes"],
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/pdfs/:path*", headers: PDF_HEADERS },
    ];
  },
};

export default nextConfig;

// Optional: integrate OpenNext Cloudflare for local dev (bindings, etc.)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
