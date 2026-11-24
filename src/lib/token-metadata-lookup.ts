import { parseAssetDisplayMetadata, resolveImageUrlFromSources } from "@/lib/extract-media-url";
import { normalizeHexData } from "@/lib/tx-details";
import { readTextCapped } from "@/lib/bounded-body";
import { blake3 } from "@noble/hashes/blake3";
import { bytesToHex } from "@noble/hashes/utils";

/** Max off-chain metadata JSON accepted from a gateway (bytes). */
const MAX_METADATA_BYTES = 512_000;

export type OffchainTokenMetadata = {
  imageUrl: string | null;
  metadataUrl: string | null;
  displayName: string | null;
  displaySymbol: string | null;
  description: string | null;
  /** True when BLAKE3 of the fetched bytes equals the on-chain `description_hash`. */
  verified: boolean;
};

const DEFAULT_URL_TEMPLATES = [
  "https://pub-fdf80a26d0d54acd86aa835377381ea3.r2.dev/metadata/{hash}.json",
  "https://pub-fdf80a26d0d54acd86aa835377381ea3.r2.dev/{hash}.json",
  "https://boing-api-prod.nico-chikuji.workers.dev/api/r2/file/metadata%2F{hash}.json",
  // No IPFS templates: `description_hash` is a BLAKE3 digest, not a CID, so `/ipfs/{hash}` never resolves
  // (and cloudflare-ipfs.com was retired).
];

/**
 * Operators can set `TOKEN_METADATA_ALLOW_UNVERIFIED=1` to accept metadata whose bytes do not hash to the
 * on-chain commitment (legacy uploads). Off by default: anything at a gateway path is otherwise trusted
 * only when it matches what the deployer committed.
 */
function allowUnverified(): boolean {
  const v = (process.env.TOKEN_METADATA_ALLOW_UNVERIFIED ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/** BLAKE3-256 hex of the UTF-8 bytes (what boing.finance commits as `description_hash`). */
export function metadataContentHashHex(text: string): string {
  return bytesToHex(blake3(new TextEncoder().encode(text)));
}

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
 * (blake3 of the launch JSON on boing.finance). Tries content-addressed R2 URLs and accepts a body only
 * when its BLAKE3 matches the hash (see `TOKEN_METADATA_ALLOW_UNVERIFIED`).
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
      // Enforce the size cap while streaming, before the body is fully buffered.
      const text = await readTextCapped(res, MAX_METADATA_BYTES);
      if (!text) continue;
      if (contentType.includes("text/html") && !looksLikeJsonObject(text)) continue;
      if (!looksLikeJsonObject(text) && !contentType.includes("json")) continue;
      const verified = metadataContentHashHex(text) === hash;
      if (!verified && !allowUnverified()) continue;
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
        verified,
      };
    } catch {
      continue;
    }
  }
  return null;
}
