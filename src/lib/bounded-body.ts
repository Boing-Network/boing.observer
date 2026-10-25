/**
 * Read an HTTP response body as text without ever buffering more than `maxBytes`.
 * Checks Content-Length first, then streams and cancels the reader as soon as the cap is exceeded,
 * so an untrusted gateway cannot make the Worker allocate an arbitrarily large string.
 * Returns `null` when the body is larger than the cap (or unreadable).
 */
export async function readTextCapped(res: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    return null;
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return null;
  }
}