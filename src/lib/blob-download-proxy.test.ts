import { describe, expect, it } from "vitest";
import { capStream, safeDownloadContentType } from "./blob-download-proxy";

function streamOf(chunks: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const n of chunks) c.enqueue(new Uint8Array(n));
      c.close();
    },
  });
}

async function drain(s: ReadableStream<Uint8Array>): Promise<number> {
  const reader = s.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

describe("safeDownloadContentType", () => {
  it("keeps media types", () => {
    expect(safeDownloadContentType("image/png")).toBe("image/png");
    expect(safeDownloadContentType("video/mp4; codecs=avc1")).toBe("video/mp4");
    expect(safeDownloadContentType("application/pdf")).toBe("application/pdf");
  });
  it("downgrades anything that could render as a page", () => {
    expect(safeDownloadContentType("text/html")).toBe("application/octet-stream");
    expect(safeDownloadContentType("application/xhtml+xml")).toBe("application/octet-stream");
    expect(safeDownloadContentType("text/javascript")).toBe("application/octet-stream");
    expect(safeDownloadContentType(null)).toBe("application/octet-stream");
  });
});

describe("capStream", () => {
  it("passes bodies under the cap", async () => {
    expect(await drain(capStream(streamOf([10, 20]), 30))).toBe(30);
  });
  it("errors once the cap is exceeded", async () => {
    await expect(drain(capStream(streamOf([20, 20]), 30))).rejects.toThrow(/limit/);
  });
});
