/**
 * Helpers for permission-gated media-blob downloads.
 * Blob id is BLAKE3(data); slim PutBlob stubs expose it as `data.hash`.
 */

import { normalizeHex64 } from "./rpc-types";

const DOWNLOAD_TOKEN_STORAGE_KEY = "boing.observer.blobDownloadToken";

export type PutBlobDownloadHint = {
  blobId: string;
  size: number | null;
  contentType: string | null;
  omitted: boolean;
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
