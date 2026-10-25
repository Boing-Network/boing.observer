import { describe, expect, it } from "vitest";
import { extractPutBlobDownloadHint } from "./blob-download";

describe("extractPutBlobDownloadHint", () => {
  it("reads slim PutBlob stub hash as blob id", () => {
    const hint = extractPutBlobDownloadHint({
      content_type: "application/octet-stream",
      data: {
        omitted: true,
        size: 33554432,
        hash: "0x8095c12fc5f894bdf3cbdc7788f6ef52900fe3f5ab96a54881b288c6b070b265",
      },
    });
    expect(hint).toEqual({
      blobId: "8095c12fc5f894bdf3cbdc7788f6ef52900fe3f5ab96a54881b288c6b070b265",
      size: 33554432,
      contentType: "application/octet-stream",
      omitted: true,
    });
  });

  it("reads BlobAnnounce blob_id", () => {
    const hint = extractPutBlobDownloadHint({
      blob_id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      size: 12,
      content_type: "image/png",
    });
    expect(hint?.blobId).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(hint?.omitted).toBe(false);
    expect(hint?.size).toBe(12);
  });

  it("returns null without an id", () => {
    expect(extractPutBlobDownloadHint({ content_type: "text/plain" })).toBeNull();
  });
});
