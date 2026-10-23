/**
 * Installs `@boing-network/boing-sdk` from the pinned `boing-network-root` monorepo
 * checkout (directory `boing-sdk/` inside that repo) into
 * `node_modules/@boing-network/boing-sdk`.
 *
 * Default: overlay from the pinned monorepo commit (scoped package not yet on npm,
 * or tip ahead of registry). Set BOING_OBSERVER_USE_NPM_SDK=1 to keep a published
 * `@boing-network/boing-sdk` from the registry instead.
 * To bump the SDK: change the commit in package.json `boing-network-root`, then npm install.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const cwd = process.cwd();
const src = join(cwd, "node_modules", "boing-network-root", "boing-sdk");
const dst = join(cwd, "node_modules", "@boing-network", "boing-sdk");

function overlayFromMonorepo(reason) {
  if (!existsSync(join(src, "package.json"))) {
    console.warn(
      `[sync-boing-sdk] node_modules/boing-network-root/boing-sdk not found (${reason}).`,
    );
    return false;
  }
  if (existsSync(dst)) {
    rmSync(dst, { recursive: true, force: true });
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[sync-boing-sdk] Overlaid @boing-network/boing-sdk from pinned boing-network-root (${reason})`);
  return true;
}

if (process.env.BOING_OBSERVER_USE_NPM_SDK === "1") {
  if (existsSync(join(dst, "package.json"))) {
    console.log("[sync-boing-sdk] Using npm @boing-network/boing-sdk (BOING_OBSERVER_USE_NPM_SDK=1)");
    process.exit(0);
  }
  if (overlayFromMonorepo("npm package missing")) process.exit(0);
  console.warn(
    "[sync-boing-sdk] No @boing-network/boing-sdk found (npm install @boing-network/boing-sdk@^0.5.24 or clone boing-network-root).",
  );
  process.exit(0);
}

if (overlayFromMonorepo("default monorepo overlay")) process.exit(0);

console.warn(
  "[sync-boing-sdk] No @boing-network/boing-sdk found (set boing-network-root or npm install @boing-network/boing-sdk).",
);
