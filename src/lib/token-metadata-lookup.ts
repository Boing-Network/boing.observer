import { parseAssetDisplayMetadata, resolveImageUrlFromSources } from "@/lib/extract-media-url";
import { normalizeHexData } from "@/lib/tx-details";

export type OffchainTokenMetadata = {
  imageUrl: string | null;
  metadataUrl: string | null;
  displayName: string | null;
  displaySymbol: string | null;
  description: string | null;
};

const DEFAULT_URL_TEMPLATES = [
  "https://pub-fdf80a26d0d54acd86aa835377381ea3.r2.dev/metadata/{hash}.json",
  "https://pub-fdf80a26d0d54acd86aa835377381ea3.r2.dev/{hash}.json",
  "https://boing-api-prod.nico-chikuji.workers.dev/api/r2/file/metadata%2F{hash}.json",
  "https://ipfs.io/ipfs/{hash}",
  "https://cloudflare-ipfs.com/ipfs/{hash}",
];

/** Public R2 rejects requests with no browser-like User-Agent (HTTP 403). */
const METADATA_FETCH_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (compatible; BoingObserver/1.0; +https://boing.observer) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export function descriptionHashToHex64(value: unknown): string | null {
  const dh = normalizeHexData(value);
  if (dh.bytes !== 32) return null;
  const hex = dh.prefixed.replace(/^0x/i, "").toLowerCase();
  if (!hex || /^0+$/.test(hex)) return null;
  return hex;
}

function metadataUrlTemplates(): string[] {
  const extra = (process.env.TOKEN_METADATA_GATEWAY_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...extra, ...DEFAULT_URL_TEMPLATES];
}

function looksLikeJsonObject(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") && t.endsWith("}");
}

/**
 * Resolve off-chain token/NFT metadata JSON that was committed as `description_hash`
 * (blake3 of the launch JSON on boing.finance). Tries content-addressed R2/IPFS URLs.
 */
export async function resolveOffchainTokenMetadata(
  descriptionHash: unknown,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<OffchainTokenMetadata | null> {
  const hash = descriptionHashToHex64(descriptionHash);
  if (!hash) return null;

  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 4_000;
  const templates = metadataUrlTemplates();

  for (const tmpl of templates) {
    const url = tmpl.replaceAll("{hash}", hash);
    try {
      const res = await fetchImpl(url, {
        headers: METADATA_FETCH_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      const text = await res.text();
      if (!text || text.length > 512_000) continue;
      if (contentType.includes("text/html") && !looksLikeJsonObject(text)) continue;
      if (!looksLikeJsonObject(text) && !contentType.includes("json")) continue;
      const parsed = JSON.parse(text) as unknown;
      const imageUrl = resolveImageUrlFromSources(
        text,
        typeof parsed === "object" && parsed && "image" in parsed
          ? String((parsed as { image?: unknown }).image ?? "")
          : null,
      );
      const display = parseAssetDisplayMetadata(text);
      return {
        imageUrl: imageUrl ?? display.imageUrl,
        metadataUrl: url,
        displayName: display.displayName,
        displaySymbol: display.displaySymbol,
        description: display.description,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function mergeAssetImageUrl(
  fromOnChain: string | null | undefined,
  fromOffchain: OffchainTokenMetadata | null,
): string | null {
  return fromOnChain || fromOffchain?.imageUrl || null;
}
