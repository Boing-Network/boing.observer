import "server-only";

import type { BoingClient } from "boing-sdk";
import { validateHex32 } from "boing-sdk";
import { resolveImageUrlFromSources } from "@/lib/extract-media-url";
import {
  fetchFirstMetadataJson,
  metadataHashWordToFetchUrls,
  referenceNftMetadataStorageKey,
  referenceNftTokenIdWordFromU64,
} from "@/lib/reference-nft-storage";

export type ReferenceNftSample = {
  tokenIdU64: number;
  tokenIdWord: string;
  metadataHash: string;
  imageUrl: string | null;
  metadataUrl: string | null;
  metadataName: string | null;
};

function isZeroWordHex(hex: string): boolean {
  return /^0+$/.test(hex.replace(/^0x/i, ""));
}

/**
 * Probe a reference-layout NFT collection for minted token metadata (sequential ids 1..maxProbe).
 */
export async function probeReferenceNftCollectionSamples(
  client: BoingClient,
  collectionHex: string,
  options?: { maxProbe?: number },
): Promise<ReferenceNftSample[]> {
  const contract = validateHex32(collectionHex);
  const maxProbe = Math.min(24, Math.max(1, options?.maxProbe ?? 8));
  const samples: ReferenceNftSample[] = [];

  for (let tokenIdU64 = 1; tokenIdU64 <= maxProbe; tokenIdU64++) {
    const tokenIdWord = referenceNftTokenIdWordFromU64(tokenIdU64);
    const storageKey = referenceNftMetadataStorageKey(tokenIdWord);
    let metadataHash: string;
    try {
      const word = await client.getContractStorage(contract, storageKey);
      metadataHash = typeof word === "string" ? word : String(word);
    } catch {
      continue;
    }
    if (isZeroWordHex(metadataHash)) continue;

    const fetchUrls = metadataHashWordToFetchUrls(metadataHash);
    let imageUrl: string | null = null;
    let metadataUrl: string | null = null;
    let metadataName: string | null = null;

    if (fetchUrls.length > 0) {
      const fetched = await fetchFirstMetadataJson(fetchUrls);
      if (fetched?.ok) {
        metadataUrl = fetched.url;
        imageUrl = fetched.imageUrl;
        if (fetched.json && typeof fetched.json === "object" && fetched.json !== null) {
          const name = (fetched.json as Record<string, unknown>).name;
          if (typeof name === "string" && name.trim()) metadataName = name.trim();
        }
      }
    }

    if (!imageUrl) {
      imageUrl = resolveImageUrlFromSources(metadataHash);
    }

    samples.push({
      tokenIdU64,
      tokenIdWord,
      metadataHash,
      imageUrl,
      metadataUrl,
      metadataName,
    });
  }

  return samples;
}
