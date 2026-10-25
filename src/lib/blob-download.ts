/**
 * Helpers for permission-gated media-blob downloads (operator token + Phase 34 wallet proofs).
 * Blob id is BLAKE3(data); slim PutBlob stubs expose it as `data.hash`.
 */

import {
  blobDownloadProofHeaders,
  blobDownloadProofPreimage,
  bytesToHex,
  hexToBytes,
} from "@boing-network/boing-sdk";
import { normalizeHex64 } from "./rpc-types";

const DOWNLOAD_TOKEN_STORAGE_KEY = "boing.observer.blobDownloadToken";

export type PutBlobDownloadHint = {
  blobId: string;
  size: number | null;
  contentType: string | null;
  omitted: boolean;
};

export type BlobAccessInfo = {
  publisher: string;
  grantees: string[];
  epoch: number;
  aclActive: boolean;
};

export function extractPutBlobDownloadHint(inner: Record<string, unknown>): PutBlobDownloadHint | null {
  const data = inner.data;
  let blobId: string | null = null;
  let size: number | null = null;
  let omitted = false;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const stub = data as { omitted?: unknown; size?: unknown; hash?: unknown };
    if (stub.omitted) omitted = true;
    if (typeof stub.size === "number" && Number.isFinite(stub.size)) size = stub.size;
    if (typeof stub.hash === "string") blobId = normalizeHex64(stub.hash);
  } else if (typeof data === "string" && data.startsWith("0x") && data.length >= 4) {
    size = Math.max(0, Math.floor((data.length - 2) / 2));
  } else if (Array.isArray(data)) {
    size = data.length;
  }

  const fromField =
    normalizeHex64(typeof inner.blob_id === "string" ? inner.blob_id : "") ||
    normalizeHex64(typeof inner.blobId === "string" ? inner.blobId : "");
  if (!blobId && fromField) blobId = fromField;

  if (!blobId) return null;

  const contentType =
    typeof inner.content_type === "string"
      ? inner.content_type
      : typeof inner.contentType === "string"
        ? inner.contentType
        : null;

  if (size == null && typeof inner.size === "number" && Number.isFinite(inner.size)) {
    size = inner.size;
  }

  return { blobId, size, contentType, omitted };
}

export function readStoredBlobDownloadToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(DOWNLOAD_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function storeBlobDownloadToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = token.trim();
    if (t) sessionStorage.setItem(DOWNLOAD_TOKEN_STORAGE_KEY, t);
    else sessionStorage.removeItem(DOWNLOAD_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredBlobDownloadToken(): void {
  storeBlobDownloadToken("");
}

/** Random 32-byte nonce for a download proof. */
export function randomBlobDownloadNonce(): Uint8Array {
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  return nonce;
}

/** Hex message for `boing_signMessage` (32-byte BLAKE3 preimage). */
export function blobDownloadProofMessageHex(input: {
  chainId: number;
  blobIdHex: string;
  expiresAtUnix: number;
  nonce: Uint8Array;
}): string {
  const blobId = hexToBytes(input.blobIdHex.startsWith("0x") ? input.blobIdHex : `0x${input.blobIdHex}`);
  const preimage = blobDownloadProofPreimage({
    chainId: input.chainId,
    blobId,
    expiresAtUnix: input.expiresAtUnix,
    nonce: input.nonce,
  });
  return `0x${bytesToHex(preimage)}`;
}

export function buildBlobDownloadProofHeaders(input: {
  downloaderHex: string;
  expiresAtUnix: number;
  nonce: Uint8Array;
  signatureHex: string;
}): Record<string, string> {
  const downloader = hexToBytes(
    input.downloaderHex.startsWith("0x") ? input.downloaderHex : `0x${input.downloaderHex}`
  );
  const signature = hexToBytes(
    input.signatureHex.startsWith("0x") ? input.signatureHex : `0x${input.signatureHex}`
  );
  return blobDownloadProofHeaders({
    downloader,
    expiresAtUnix: input.expiresAtUnix,
    nonce: input.nonce,
    signature64: signature,
  });
}
