/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["boing-sdk"],
  /** Peer deps of boing-sdk must resolve from app node_modules when the server bundle inlines the SDK. */
  serverExternalPackages: ["@noble/ed25519", "@noble/hashes"],
};

export default nextConfig;

// Optional: integrate OpenNext Cloudflare for local dev (bindings, etc.)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
