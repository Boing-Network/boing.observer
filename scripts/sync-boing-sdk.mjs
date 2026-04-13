/**
 * Optional overlay: copies boing-sdk from the cloned boing.network monorepo into
 * node_modules/boing-sdk when BOING_OBSERVER_USE_MONOREPO_SDK=1.
 *
 * Default: keep the npm `boing-sdk` package (see package.json) so JSON-RPC surfaces
 * match published releases (e.g. listDexPoolsPage / boing_listDexPools on ^0.3.0).
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const src = join(cwd, "node_modules", "boing-network-root", "boing-sdk");
const dst = join(cwd, "node_modules", "boing-sdk");

if (process.env.BOING_OBSERVER_USE_MONOREPO_SDK === "1") {
  if (!existsSync(join(src, "package.json"))) {
    console.warn("[sync-boing-sdk] BOING_OBSERVER_USE_MONOREPO_SDK=1 but node_modules/boing-network-root/boing-sdk not found.");
    process.exit(0);
  }
  if (existsSync(dst)) {
    rmSync(dst, { recursive: true, force: true });
  }
  cpSync(src, dst, { recursive: true });
  console.log("[sync-boing-sdk] Overlaid boing-sdk from boing-network-root");
  process.exit(0);
}

if (existsSync(join(dst, "package.json"))) {
  console.log("[sync-boing-sdk] Using npm boing-sdk (set BOING_OBSERVER_USE_MONOREPO_SDK=1 to overlay from monorepo)");
  process.exit(0);
}

if (existsSync(join(src, "package.json"))) {
  cpSync(src, dst, { recursive: true });
  console.log("[sync-boing-sdk] Installed boing-sdk from boing-network-root (npm package missing)");
  process.exit(0);
}

console.warn("[sync-boing-sdk] No boing-sdk found (npm install boing-sdk or clone boing-network-root).");
