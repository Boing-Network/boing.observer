import { describe, expect, it } from "vitest";
import { readTextCapped } from "./bounded-body";

function streamOf(chunks: string[], onPull?: () => void): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(c) {
      onPull?.();
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
      else c.close();
    },
  });
}

describe("readTextCapped", () => {
  it("returns small bodies in full (multi-chunk, multi-byte safe)", async () => {
    const res = new Response(streamOf(["{\"a\":\"", "\u00e9\u20ac", "\"}"]));
    expect(await readTextCapped(res, 1000)).toBe("{\"a\":\"\u00e9\u20ac\"}");
  });
  it("rejects on declared Content-Length without reading the body", async () => {
    let pulled = 0;
    const res = new Response(streamOf(["x"], () => pulled++), { headers: { "content-length": "999999" } });
    expect(await readTextCapped(res, 100)).toBeNull();
    expect(pulled).toBe(0);
  });
  it("stops streaming once the cap is exceeded (no Content-Length)", async () => {
    let pulled = 0;
    const chunks = Array.from({ length: 1000 }, () => "x".repeat(100));
    const res = new Response(streamOf(chunks, () => pulled++));
    expect(await readTextCapped(res, 450)).toBeNull();
    expect(pulled).toBeLessThan(20);
  });
  it("treats an empty body as empty string", async () => {
    expect(await readTextCapped(new Response(null), 10)).toBe("");
  });
});