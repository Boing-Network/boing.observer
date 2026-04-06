/**
 * Copies boing-sdk from the cloned boing.network monorepo into node_modules/boing-sdk
 * so the package name `boing-sdk` resolves (npm git installs do not always honor subpaths).
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const src = join(cwd, "node_modules", "boing-network-root", "boing-sdk");
const dst = join(cwd, "node_modules", "boing-sdk");

if (!existsSync(join(src, "package.json"))) {
  console.warn("[sync-boing-sdk] Skip: node_modules/boing-network-root/boing-sdk not found.");
  process.exit(0);
}

if (existsSync(dst)) {
  rmSync(dst, { recursive: true, force: true });
}
cpSync(src, dst, { recursive: true });
console.log("[sync-boing-sdk] Installed boing-sdk into node_modules/boing-sdk");
