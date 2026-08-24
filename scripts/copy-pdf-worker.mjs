/**
 * Copy the pdf.js worker next to the app so PDF rendering stays same-origin.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function resolveWorker() {
  const candidates = [
    "pdfjs-dist/build/pdf.worker.min.mjs",
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  ];
  for (const id of candidates) {
    try {
      return require.resolve(id);
    } catch {
      /* try next */
    }
  }
  return null;
}

const src = resolveWorker();
const destDir = join(root, "public", "pdfjs");
const dest = join(destDir, "pdf.worker.min.mjs");

if (!src) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found; About PDF pages will fail until `npm install`.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
cpSync(src, dest);
console.log("[copy-pdf-worker] wrote", dest);
