const MAX_URL = 2048;

const IMAGE_KEYS = [
  "image",
  "image_url",
  "imageUrl",
  "imageURI",
  "imageUri",
  "logo",
  "logoURI",
  "logoUri",
  "logo_url",
  "icon",
  "icon_url",
  "animation_url",
  "picture",
] as const;
const NAME_KEYS = ["name", "title", "collection"] as const;
const SYMBOL_KEYS = ["symbol", "ticker"] as const;

export type AssetDisplayMetadata = {
  displayName: string | null;
  displaySymbol: string | null;
  imageUrl: string | null;
  description: string | null;
};

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
        const fromJson = imageUrlFromJsonObject(parsed);
        if (fromJson) return fromJson;
      } catch {
        /* not JSON */
      }
    }

    if (isStandaloneMediaUrl(text)) {
      const g = extractHttpOrIpfsUrl(text);
      if (g) return g;
    }
  }
  return null;
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

function imageUrlFromJsonObject(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  for (const key of IMAGE_KEYS) {
    const u = readMetadataImageField(o[key]);
    if (u) {
      const g = extractHttpOrIpfsUrl(u);
      if (g) return g;
      if (/^https?:\/\//i.test(u) && u.length <= MAX_URL) return u;
    }
  }
  const properties = o.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    const nested = imageUrlFromJsonObject(properties);
    if (nested) return nested;
    const files = (properties as Record<string, unknown>).files;
    if (Array.isArray(files)) {
      for (const file of files) {
        if (file && typeof file === "object") {
          const rec = file as Record<string, unknown>;
          const u = readMetadataImageField(rec.uri ?? rec.url ?? rec.image);
          if (u) {
            const g = extractHttpOrIpfsUrl(u);
            if (g) return g;
          }
        }
      }
    }
  }
  return null;
}

function readStringField(o: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = o[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** True when the whole field is a media URI, not a human name that happens to mention a URL. */
export function isStandaloneMediaUrl(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > MAX_URL) return false;
  if (/^ipfs:\/\/\S+$/i.test(t)) return true;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(t)) return true;
  return false;
}

function humanizeMetadataField(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const json = tryParseJsonObject(t);
  if (json) {
    const name = readStringField(json, NAME_KEYS);
    if (name && !isStandaloneMediaUrl(name)) return name;
    return null;
  }
  if (isStandaloneMediaUrl(t)) return null;
  return t;
}

/**
 * Turn deploy `asset_name` / `asset_symbol` (plain text, image URL, or inline JSON)
 * into the fields UIs should show next to the asset identity.
 */
export function parseAssetDisplayMetadata(
  assetName?: string | null,
  assetSymbol?: string | null,
): AssetDisplayMetadata {
  const sources = [assetName, assetSymbol];
  let displayName: string | null = null;
  let displaySymbol: string | null = null;
  let description: string | null = null;

  for (const raw of sources) {
    if (raw == null) continue;
    const json = tryParseJsonObject(raw);
    if (!json) continue;
    if (!displayName) {
      const name = readStringField(json, NAME_KEYS);
      if (name && !isStandaloneMediaUrl(name)) displayName = name;
    }
    if (!displaySymbol) {
      const symbol = readStringField(json, SYMBOL_KEYS);
      if (symbol && !isStandaloneMediaUrl(symbol)) displaySymbol = symbol;
    }
    if (!description) {
      description = readStringField(json, ["description"]);
    }
  }

  if (!displayName) displayName = humanizeMetadataField(assetName);
  if (!displaySymbol) {
    const symbol = humanizeMetadataField(assetSymbol);
    if (symbol && symbol !== displayName) displaySymbol = symbol;
  }

  return {
    displayName,
    displaySymbol,
    imageUrl: resolveImageUrlFromSources(assetName, assetSymbol),
    description,
  };
}

export function formatAssetDisplayLabel(
  meta: AssetDisplayMetadata,
  fallback = "Unnamed",
): string {
  const parts = [meta.displayName, meta.displaySymbol].filter(Boolean);
  return parts.length ? parts.join(" · ") : fallback;
}
