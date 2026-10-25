#!/usr/bin/env node
/**
 * Refresh `src/data/chain-metadata.json` from boing.network `docs/chain-metadata.json` (main).
 *
 *   npm run sync:chain-metadata                 # sibling checkout ../boing.network (git show main:…), else GitHub raw
 *   npm run sync:chain-metadata -- <path|url>   # explicit source
 *
 * Reviewing the diff and re-running `npm test` is the upgrade path: `chain-metadata.test.ts` pins the
 * schema version and cross-checks the constants this app hard-codes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, "src/data/chain-metadata.json");
const sibling = resolve(root, "..", "boing.network");
const RAW_URL = "https://raw.githubusercontent.com/Boing-Network/boing.network/main/docs/chain-metadata.json";

async function load() {
  const arg = process.argv[2];
  if (arg && /^https?:\/\//.test(arg)) return fetchText(arg);
  if (arg) return readFileSync(resolve(arg), "utf8");
  if (existsSync(resolve(sibling, ".git"))) {
    try {
      return execFileSync("git", ["-C", sibling, "show", "main:docs/chain-metadata.json"], { encoding: "utf8" });
    } catch {
      /* fall through to the network */
    }
  }
  return fetchText(RAW_URL);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

const text = await load();
const parsed = JSON.parse(text);
if (parsed.schema_version !== 1) {
  console.error(`Unsupported schema_version ${parsed.schema_version}; update src/lib/chain-metadata.ts deliberately first.`);
  process.exit(1);
}
writeFileSync(dest, text.endsWith("\n") ? text : `${text}\n`, "utf8");
console.log(`Wrote ${dest} (schema_version ${parsed.schema_version}, ${parsed.networks?.length ?? 0} networks).`);