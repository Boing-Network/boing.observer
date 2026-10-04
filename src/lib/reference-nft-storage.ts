import { bytesToHex, hexToBytes, validateHex32 } from "boing-sdk";
import { resolveImageUrlFromSources, extractHttpOrIpfsUrl } from "@/lib/extract-media-url";

/** Mirrors `REF_NFT_OWNER_STORAGE_XOR` in `boing-execution` `reference_nft.rs`. */
const REF_NFT_OWNER_STORAGE_XOR_HEX = validateHex32(
  "0x424f494e475f5245464e46545f4f574e45523031000000000000000000000000",
);

/** Mirrors `REF_NFT_METADATA_STORAGE_XOR` in `boing-execution` `reference_nft.rs`. */
const REF_NFT_METADATA_STORAGE_XOR_HEX = validateHex32(
  "0x424f494e475f5245464e46545f4d455441303100000000000000000000000000",
);

function xorWords(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = a[i]! ^ b[i]!;
  return out;
}

function xorStorageKey(tokenIdHex32: string, xorHex32: string): string {
  const tokenId = hexToBytes(validateHex32(tokenIdHex32));
  const mask = hexToBytes(validateHex32(xorHex32));
  return bytesToHex(xorWords(tokenId, mask));
}

export function referenceNftTokenIdWordFromU64(id: number): string {
  let n = BigInt(id);
  const out = new Uint8Array(32);
  const mask = BigInt(255);
  const eight = BigInt(8);
  for (let i = 31; i >= 24; i--) {
    out[i] = Number(n & mask);
    n >>= eight;
  }
  return bytesToHex(out);
}

export function referenceNftOwnerStorageKey(tokenIdHex32: string): string {
  return xorStorageKey(tokenIdHex32, REF_NFT_OWNER_STORAGE_XOR_HEX);
}

export function referenceNftMetadataStorageKey(tokenIdHex32: string): string {
  return xorStorageKey(tokenIdHex32, REF_NFT_METADATA_STORAGE_XOR_HEX);
}

function isZeroWordHex(hex32: string): boolean {
  const raw = hex32.replace(/^0x/i, "");
  return raw.length === 0 || /^0+$/.test(raw);
}

/**
 * Candidate fetch URLs for a 32-byte on-chain metadata commitment (reference NFT `metadata_hash` slot).
 * Tries embedded URI text in the word, then `ipfs.io/ipfs/{hex}`.
 */
export function metadataHashWordToFetchUrls(metadataHashHex32: string): string[] {
  const hex = metadataHashHex32.replace(/^0x/i, "");
  if (hex.length !== 64 || isZeroWordHex(hex)) return [];

  const out: string[] = [];
  try {
    const bytes = Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const ascii = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\0+$/g, "").trim();
    const fromAscii = extractHttpOrIpfsUrl(ascii);
    if (fromAscii) out.push(fromAscii);
  } catch {
    /* ignore */
  }

  const ipfsPath = `https://ipfs.io/ipfs/${hex}`;
  if (!out.includes(ipfsPath)) out.push(ipfsPath);
  return out.slice(0, 4);
}

export async function fetchFirstMetadataJson(
  urls: readonly string[],
): Promise<{ ok: true; url: string; json: unknown; imageUrl: string | null } | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json, text/plain, */*" },
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      let imageUrl: string | null = null;
      if (json && typeof json === "object" && !Array.isArray(json)) {
        const o = json as Record<string, unknown>;
        imageUrl = resolveImageUrlFromSources(
          typeof o.image === "string" ? o.image : null,
          typeof o.image_url === "string" ? o.image_url : null,
          typeof o.logoURI === "string" ? o.logoURI : null,
        );
      }
      return { ok: true, url, json, imageUrl };
    } catch {
      continue;
    }
  }
  return null;
}

/** Normalize `boing_getContractStorage` result (`{ value }` or bare hex string) to 0x-hex. */
export function contractStorageWordToHex(word: unknown): string | null {
  if (typeof word === "string" && word.trim()) {
    const t = word.trim();
    return t.startsWith("0x") || t.startsWith("0X") ? t : `0x${t}`;
  }
  if (word && typeof word === "object" && "value" in word) {
    const v = (word as { value: unknown }).value;
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      return t.startsWith("0x") || t.startsWith("0X") ? t : `0x${t}`;
    }
  }
  return null;
}

export function isZeroContractStorageWord(word: unknown): boolean {
  const hex = contractStorageWordToHex(word);
  return hex == null || isZeroWordHex(hex);
}
