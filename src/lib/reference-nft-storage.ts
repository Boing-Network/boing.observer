import { bytesToHex, hexToBytes, validateHex32 } from "boing-sdk";
import { resolveImageUrlFromSources } from "@/lib/extract-media-url";

const REF_NFT_METADATA_STORAGE_XOR_HEX = validateHex32(
  "0x424f494e475f5245464e46545f4d455441303100000000000000000000000000",
);

function xorWords(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = a[i]! ^ b[i]!;
  return out;
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

export function referenceNftMetadataStorageKey(tokenIdHex32: string): string {
  const tokenId = hexToBytes(validateHex32(tokenIdHex32));
  const mask = hexToBytes(REF_NFT_METADATA_STORAGE_XOR_HEX);
  return bytesToHex(xorWords(tokenId, mask));
}

export function metadataHashWordToFetchUrls(metadataHashHex32: string): string[] {
  const hex = metadataHashHex32.replace(/^0x/i, "");
  if (hex.length !== 64 || /^0+$/.test(hex)) return [];
  return [`https://ipfs.io/ipfs/${hex}`];
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
