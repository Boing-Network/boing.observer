/**
 * Helpers for `GET /api/blob/download` (kept out of `route.ts`: Next route modules may only export handlers/config).
 */

/** Media types the explorer will label a download with; anything else becomes octet-stream. */
const SAFE_CONTENT_TYPE = /^(?:(?:image|video|audio)\/[a-z0-9.+-]+|application\/(?:pdf|json|octet-stream))$/;

export function safeDownloadContentType(raw: string | null): string {
  const base = (raw ?? "").split(";")[0]!.trim().toLowerCase();
  return SAFE_CONTENT_TYPE.test(base) ? base : "application/octet-stream";
}

/** Pass bytes through, but fail the stream once more than `max` bytes arrive (chunked bodies have no length). */
export function capStream(body: ReadableStream<Uint8Array>, max: number): ReadableStream<Uint8Array> {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > max) {
          controller.error(new Error(`Blob exceeds the ${max}-byte explorer proxy limit`));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );
}
