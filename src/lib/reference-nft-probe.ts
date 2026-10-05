import "server-only";

import type { BoingClient } from "boing-sdk";
import { validateHex32 } from "boing-sdk";
import { resolveImageUrlFromSources } from "@/lib/extract-media-url";
import { tryReferenceNftTokenIdU64 } from "@/lib/reference-nft-calldata";
import {
  contractStorageWordToHex,
  fetchFirstMetadataJson,
  isZeroContractStorageWord,
  metadataHashWordToFetchUrls,
  referenceNftMetadataStorageKey,
  referenceNftOwnerStorageKey,
  referenceNftTokenIdWordFromU64,
} from "@/lib/reference-nft-storage";
import { normalizeHex64 } from "@/lib/rpc-types";

export type ReferenceNftSample = {
  /** Sequential id when the token word is low-u64; null for opaque/hash ids (e.g. FreshMint). */
  tokenIdU64: number | null;
  tokenIdWord: string;
  metadataHash: string;
  owner: string | null;
  imageUrl: string | null;
  metadataUrl: string | null;
  metadataName: string | null;
};

async function hydrateReferenceNftSample(
  client: BoingClient,
  collectionHex: string,
  tokenIdWordRaw: string,
): Promise<ReferenceNftSample | null> {
  const contract = validateHex32(collectionHex);
  const tokenIdWord = validateHex32(tokenIdWordRaw);
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
    return null;
  }

  const metadataHash = contractStorageWordToHex(metaWord);
  const ownerHex = contractStorageWordToHex(ownerWord);
  const metaEmpty = metadataHash == null || isZeroContractStorageWord(metadataHash);
  const ownerEmpty = ownerHex == null || isZeroContractStorageWord(ownerHex);
  if (metaEmpty && ownerEmpty) return null;

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

  const word64 = normalizeHex64(tokenIdWord.replace(/^0x/i, "")) ?? tokenIdWord.replace(/^0x/i, "").toLowerCase();

  return {
    tokenIdU64: tryReferenceNftTokenIdU64(tokenIdWord),
    tokenIdWord: word64,
    metadataHash: metaEmpty ? "" : metadataHash!,
    owner: ownerEmpty ? null : ownerHex!.replace(/^0x/i, "").toLowerCase(),
    imageUrl,
    metadataUrl,
    metadataName,
  };
}

/** Look up one minted reference NFT by opaque 32-byte token id word. */
export async function probeReferenceNftItem(
  client: BoingClient,
  collectionHex: string,
  tokenIdHex32: string,
): Promise<ReferenceNftSample | null> {
  return hydrateReferenceNftSample(client, collectionHex, tokenIdHex32);
}

/**
 * Probe a reference-layout NFT collection for minted token metadata.
 * Always tries sequential ids 1..maxProbe, then any extra opaque token-id words
 * (e.g. decoded from mint_batch calldata — FreshMint uses hash ids).
 */
export async function probeReferenceNftCollectionSamples(
  client: BoingClient,
  collectionHex: string,
  options?: { maxProbe?: number; extraTokenIdWords?: readonly string[] },
): Promise<ReferenceNftSample[]> {
  const maxProbe = Math.min(24, Math.max(1, options?.maxProbe ?? 8));
  const seen = new Set<string>();
  const samples: ReferenceNftSample[] = [];

  const consider = async (tokenIdWord: string) => {
    let normalized: string;
    try {
      normalized = validateHex32(tokenIdWord).replace(/^0x/i, "").toLowerCase();
    } catch {
      return;
    }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const sample = await hydrateReferenceNftSample(client, collectionHex, tokenIdWord);
    if (sample) samples.push(sample);
  };

  for (let tokenIdU64 = 1; tokenIdU64 <= maxProbe; tokenIdU64++) {
    await consider(referenceNftTokenIdWordFromU64(tokenIdU64));
  }

  for (const extra of options?.extraTokenIdWords ?? []) {
    await consider(extra);
  }

  return samples;
}
