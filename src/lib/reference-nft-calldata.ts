/**
 * Decode reference NFT calldata (Boing-defined). See boing.network `BOING-REFERENCE-NFT.md`.
 * Kept local so the explorer works without a newer boing-sdk decode export.
 */

import { bytesToHex, hexToBytes, validateHex32 } from "boing-sdk";

export const REF_NFT_SELECTOR_OWNER_OF = 0x03;
export const REF_NFT_SELECTOR_TRANSFER_NFT = 0x04;
export const REF_NFT_SELECTOR_SET_METADATA_HASH = 0x05;
export const REF_NFT_SELECTOR_MINT_BATCH = 0x06;

/** Soft decode cap (template v3 max is 500). */
export const REF_NFT_MINT_BATCH_DECODE_MAX = 500;

function normalizeCalldataBytes(calldata: string | Uint8Array): Uint8Array | null {
  if (calldata instanceof Uint8Array) return calldata.length >= 32 ? calldata : null;
  const t = calldata.trim();
  if (!t) return null;
  try {
    const bytes = hexToBytes(t.startsWith("0x") || t.startsWith("0X") ? t : `0x${t}`);
    return bytes.length >= 32 ? bytes : null;
  } catch {
    return null;
  }
}

function wordHex(bytes: Uint8Array, offset: number): string {
  return bytesToHex(bytes.subarray(offset, offset + 32));
}

function readBeU64Low8(word: Uint8Array): number | null {
  for (let i = 0; i < 24; i++) {
    if (word[i] !== 0) return null;
  }
  let n = 0n;
  for (let i = 24; i < 32; i++) {
    n = (n << 8n) | BigInt(word[i]!);
  }
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(n);
}

/** Selector byte is the last byte of the first 32-byte word. */
export function referenceNftCalldataSelector(calldata: string | Uint8Array): number | null {
  const bytes = normalizeCalldataBytes(calldata);
  if (!bytes) return null;
  return bytes[31] ?? null;
}

/**
 * If `tokenId` is a sequential reference id (high 24 bytes zero), return that u64.
 * FreshMint-style opaque hash ids return null.
 */
export function tryReferenceNftTokenIdU64(tokenIdHex32: string): number | null {
  try {
    const bytes = hexToBytes(validateHex32(tokenIdHex32));
    return readBeU64Low8(bytes);
  } catch {
    return null;
  }
}

export type DecodedReferenceMintBatch = {
  selector: typeof REF_NFT_SELECTOR_MINT_BATCH;
  to: string;
  n: number;
  tokenIds: string[];
  metadataHashes: string[];
};

export type DecodedReferenceTransferNft = {
  selector: typeof REF_NFT_SELECTOR_TRANSFER_NFT;
  to: string;
  tokenId: string;
};

export type DecodedReferenceSetMetadataHash = {
  selector: typeof REF_NFT_SELECTOR_SET_METADATA_HASH;
  tokenId: string;
  metadataHash: string;
};

export type DecodedReferenceOwnerOf = {
  selector: typeof REF_NFT_SELECTOR_OWNER_OF;
  tokenId: string;
};

export type DecodedReferenceNftCall =
  | DecodedReferenceMintBatch
  | DecodedReferenceTransferNft
  | DecodedReferenceSetMetadataHash
  | DecodedReferenceOwnerOf;

/** Best-effort decode of reference NFT collection calldata. Returns null when unrecognized. */
export function decodeReferenceNftCalldata(calldata: string | Uint8Array): DecodedReferenceNftCall | null {
  const bytes = normalizeCalldataBytes(calldata);
  if (!bytes) return null;
  const selector = bytes[31]!;

  if (selector === REF_NFT_SELECTOR_MINT_BATCH) {
    if (bytes.length < 96) return null;
    const n = readBeU64Low8(bytes.subarray(64, 96));
    if (n == null || n < 1 || n > REF_NFT_MINT_BATCH_DECODE_MAX) return null;
    const expected = 96 + 64 * n;
    // Trailing zero padding is allowed by the VM; require at least the exact layout.
    if (bytes.length < expected) return null;
    for (let i = expected; i < bytes.length; i++) {
      if (bytes[i] !== 0) return null;
    }
    const to = wordHex(bytes, 32);
    const tokenIds: string[] = [];
    const metadataHashes: string[] = [];
    for (let i = 0; i < n; i++) {
      tokenIds.push(wordHex(bytes, 96 + 32 * i));
      metadataHashes.push(wordHex(bytes, 96 + 32 * n + 32 * i));
    }
    return { selector: REF_NFT_SELECTOR_MINT_BATCH, to, n, tokenIds, metadataHashes };
  }

  if (bytes.length < 96) return null;

  if (selector === REF_NFT_SELECTOR_TRANSFER_NFT) {
    return {
      selector: REF_NFT_SELECTOR_TRANSFER_NFT,
      to: wordHex(bytes, 32),
      tokenId: wordHex(bytes, 64),
    };
  }
  if (selector === REF_NFT_SELECTOR_SET_METADATA_HASH) {
    return {
      selector: REF_NFT_SELECTOR_SET_METADATA_HASH,
      tokenId: wordHex(bytes, 32),
      metadataHash: wordHex(bytes, 64),
    };
  }
  if (selector === REF_NFT_SELECTOR_OWNER_OF) {
    return {
      selector: REF_NFT_SELECTOR_OWNER_OF,
      tokenId: wordHex(bytes, 32),
    };
  }
  return null;
}

/** Collect opaque token-id words from a decoded reference NFT call. */
export function tokenIdsFromDecodedReferenceNftCall(decoded: DecodedReferenceNftCall): string[] {
  switch (decoded.selector) {
    case REF_NFT_SELECTOR_MINT_BATCH:
      return [...decoded.tokenIds];
    case REF_NFT_SELECTOR_TRANSFER_NFT:
    case REF_NFT_SELECTOR_SET_METADATA_HASH:
    case REF_NFT_SELECTOR_OWNER_OF:
      return [decoded.tokenId];
    default:
      return [];
  }
}
