import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Cache-bust `/pdfs/*.pdf` so Cloudflare and browsers pick up rewritten files. */
export function publicPdfSrc(fileName: string): string {
  const diskName = fileName.replace(/^\//, "").replace(/^pdfs\//, "");
  try {
    const buf = readFileSync(join(process.cwd(), "public", "pdfs", diskName));
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 10);
    return `/pdfs/${diskName}?v=${hash}`;
  } catch {
    return `/pdfs/${diskName}`;
  }
}
