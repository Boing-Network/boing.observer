/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["boing-sdk"],
  /** Peer deps of boing-sdk must resolve from app node_modules when the server bundle inlines the SDK. */
  serverExternalPackages: ["@noble/ed25519", "@noble/hashes"],
  async headers() {
    return [
      {
        source: "/pdfs/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Disposition", value: "inline" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Optional: integrate OpenNext Cloudflare for local dev (bindings, etc.)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
