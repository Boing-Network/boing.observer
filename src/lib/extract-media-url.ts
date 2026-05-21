const MAX_URL = 2048;

function ipfsUriToGateway(uri: string): string | null {
  const trimmed = uri.trim();
  const m = /^ipfs:\/\/(.+)$/i.exec(trimmed);
  if (!m) return null;
  let path = m[1].replace(/^\/+/, "");
  path = path.replace(/^ipfs\//i, "");
  if (!path || path.length > MAX_URL) return null;
  return `https://ipfs.io/ipfs/${path}`;
}

function readMetadataImageField(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return extractHttpOrIpfsUrl(value.trim()) ?? value.trim();
}

/** @deprecated Prefer `resolveImageUrlFromSources` from boing-sdk when available. */
export function extractHttpOrIpfsUrl(...sources: (string | null | undefined)[]): string | null {
  for (const raw of sources) {
    if (raw == null) continue;
    const text = raw.trim();
    if (!text) continue;

    const ipfsWord = /\bipfs:\/\/[^\s"'<>]+/i.exec(text);
    if (ipfsWord) {
      const g = ipfsUriToGateway(ipfsWord[0]);
      if (g && g.length <= MAX_URL) return g;
    }

    const httpsWord = /\bhttps:\/\/[^\s"'<>]{4,2048}/i.exec(text);
    if (httpsWord && httpsWord[0].length <= MAX_URL) return httpsWord[0];

    const httpWord = /\bhttp:\/\/[^\s"'<>]{4,2048}/i.exec(text);
    if (httpWord && httpWord[0].length <= MAX_URL) return httpWord[0];
  }
  return null;
}

/** Parse inline JSON metadata and standard `image` / `logoURI` keys. */
export function resolveImageUrlFromSources(...sources: (string | null | undefined)[]): string | null {
  for (const raw of sources) {
    if (raw == null) continue;
    const text = raw.trim();
    if (!text) continue;

    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const o = parsed as Record<string, unknown>;
          for (const key of ["image", "image_url", "logo", "logoURI", "animation_url"]) {
            const u = readMetadataImageField(o[key]);
            if (u) {
              const g = extractHttpOrIpfsUrl(u);
              if (g) return g;
              if (/^https?:\/\//i.test(u) && u.length <= MAX_URL) return u;
            }
          }
        }
      } catch {
        /* not JSON */
      }
    }

    const direct = extractHttpOrIpfsUrl(text);
    if (direct) return direct;
  }
  return null;
}
