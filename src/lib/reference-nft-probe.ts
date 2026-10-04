import "server-only";

import type { BoingClient } from "boing-sdk";
import { validateHex32 } from "boing-sdk";
import { resolveImageUrlFromSources } from "@/lib/extract-media-url";
import {
  contractStorageWordToHex,
  fetchFirstMetadataJson,
  isZeroContractStorageWord,
  metadataHashWordToFetchUrls,
  referenceNftMetadataStorageKey,
  referenceNftOwnerStorageKey,
  referenceNftTokenIdWordFromU64,
} from "@/lib/reference-nft-storage";

export type ReferenceNftSample = {
  tokenIdU64: number;
  tokenIdWord: string;
  metadataHash: string;
  owner: string | null;
  imageUrl: string | null;
  metadataUrl: string | null;
  metadataName: string | null;
};

/**
 * Probe a reference-layout NFT collection for minted token metadata (sequential ids 1..maxProbe).
 * Includes tokens that have an owner even when `metadata_hash` is unset (placeholder preview).
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
    const metaKey = referenceNftMetadataStorageKey(tokenIdWord);
    const ownerKey = referenceNftOwnerStorageKey(tokenIdWord);

    let metaWord: unknown;
    let ownerWord: unknown;
    try {
      [metaWord, ownerWord] = await Promise.all([
        client.getContractStorage(contract, metaKey),
        client.getContractStorage(contract, ownerKey),
      ]);
    } catch {
      continue;
    }

    const metadataHash = contractStorageWordToHex(metaWord);
    const ownerHex = contractStorageWordToHex(ownerWord);
    const metaEmpty = metadataHash == null || isZeroContractStorageWord(metadataHash);
    const ownerEmpty = ownerHex == null || isZeroContractStorageWord(ownerHex);
    if (metaEmpty && ownerEmpty) continue;

    let imageUrl: string | null = null;
    let metadataUrl: string | null = null;
    let metadataName: string | null = null;

    if (!metaEmpty && metadataHash) {
      const fetchUrls = metadataHashWordToFetchUrls(metadataHash);
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
    }

    samples.push({
      tokenIdU64,
      tokenIdWord,
      metadataHash: metaEmpty ? "" : metadataHash!,
      owner: ownerEmpty ? null : ownerHex!.replace(/^0x/i, "").toLowerCase(),
      imageUrl,
      metadataUrl,
      metadataName,
    });
  }

  return samples;
}
