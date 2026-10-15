/**
 * Copies boing-sdk from the boing.network monorepo (dependency `boing-network-root`, pinned to a
 * commit in package.json, like boing.express pins its git SDK) over node_modules/boing-sdk.
 *
 * Default: overlay from the pinned monorepo commit (npm `boing-sdk` lags the repo: 0.3.x vs 0.5.x).
 * Set BOING_OBSERVER_USE_NPM_SDK=1 to keep the published npm package instead.
 * To bump the SDK: change the commit in package.json "boing-network-root", then npm install.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const src = join(cwd, "node_modules", "boing-network-root", "boing-sdk");
const dst = join(cwd, "node_modules", "boing-sdk");

if (process.env.BOING_OBSERVER_USE_NPM_SDK !== "1") {
  if (!existsSync(join(src, "package.json"))) {
    console.warn("[sync-boing-sdk] node_modules/boing-network-root/boing-sdk not found; keeping npm boing-sdk.");
    process.exit(0);
  }
  if (existsSync(dst)) {
    rmSync(dst, { recursive: true, force: true });
  }
  cpSync(src, dst, { recursive: true });
  console.log("[sync-boing-sdk] Overlaid boing-sdk from pinned boing-network-root");
  process.exit(0);
}

if (existsSync(join(dst, "package.json"))) {
  console.log("[sync-boing-sdk] Using npm boing-sdk (BOING_OBSERVER_USE_NPM_SDK=1)");
  process.exit(0);
}

if (existsSync(join(src, "package.json"))) {
  cpSync(src, dst, { recursive: true });
  console.log("[sync-boing-sdk] Installed boing-sdk from boing-network-root (npm package missing)");
  process.exit(0);
}

console.warn("[sync-boing-sdk] No boing-sdk found (npm install boing-sdk or clone boing-network-root).");
