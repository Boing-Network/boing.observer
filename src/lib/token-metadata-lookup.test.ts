import { afterEach, describe, expect, it, vi } from "vitest";
import {
  descriptionHashToHex64,
  metadataContentHashHex,
  resolveOffchainTokenMetadata,
} from "./token-metadata-lookup";

const HASH = "ab".repeat(32);

describe("descriptionHashToHex64", () => {
  it("accepts 32-byte hex and byte arrays", () => {
    expect(descriptionHashToHex64(`0x${HASH}`)).toBe(HASH);
    expect(descriptionHashToHex64(Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0xab : 0xab)))).toBe(
      HASH,
    );
  });

  it("rejects zero and short hashes", () => {
    expect(descriptionHashToHex64("0x" + "00".repeat(32))).toBeNull();
    expect(descriptionHashToHex64("0xdead")).toBeNull();
  });
});

describe("resolveOffchainTokenMetadata", () => {
  it("reads image from JSON at the first successful gateway", async () => {
    const body = JSON.stringify({
      schema: "boing.token_launch_metadata.v1",
      name: "Pugs On The Block",
      symbol: "POTB",
      image: "https://cdn.example.com/pug.png",
    });
    const fetchImpl = vi.fn(async () => {
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    });
    const found = await resolveOffchainTokenMetadata(`0x${metadataContentHashHex(body)}`, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(found?.verified).toBe(true);
    expect(found?.imageUrl).toBe("https://cdn.example.com/pug.png");
    expect(found?.displayName).toBe("Pugs On The Block");
    expect(found?.displaySymbol).toBe("POTB");
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(init?.headers);
    expect(headers.get("User-Agent") ?? "").toMatch(/BoingObserver/);
  });

  it("skips HTML SPA fallbacks", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("<!DOCTYPE html><html><body>app</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    const found = await resolveOffchainTokenMetadata(`0x${HASH}`, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(found).toBeNull();
  });
});


describe("resolveOffchainTokenMetadata size cap", () => {
  it("skips an oversized gateway response and falls through to the next gateway", async () => {
    const big = JSON.stringify({ name: "x", pad: "y".repeat(600_000) });
    const good = JSON.stringify({ name: "Ok", symbol: "OK", image: "https://cdn.example.com/ok.png" });
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return new Response(calls === 1 ? big : good, { status: 200, headers: { "content-type": "application/json" } });
    });
    const out = await resolveOffchainTokenMetadata(`0x${metadataContentHashHex(good)}`, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(out?.imageUrl).toBe("https://cdn.example.com/ok.png");
  });
});
describe("resolveOffchainTokenMetadata hash verification", () => {
  afterEach(() => {
    delete process.env.TOKEN_METADATA_ALLOW_UNVERIFIED;
  });

  const forged = JSON.stringify({ name: "Fake", symbol: "FAKE", image: "https://evil.example/x.png" });
  const real = JSON.stringify({ name: "Real", symbol: "REAL", image: "https://cdn.example.com/real.png" });

  it("skips a gateway whose bytes do not hash to the commitment and uses the next one", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return new Response(calls === 1 ? forged : real, { status: 200, headers: { "content-type": "application/json" } });
    });
    const out = await resolveOffchainTokenMetadata(`0x${metadataContentHashHex(real)}`, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toMatchObject({ displayName: "Real", verified: true });
  });

  it("returns null when no gateway serves matching bytes", async () => {
    const fetchImpl = vi.fn(async () => new Response(forged, { status: 200, headers: { "content-type": "application/json" } }));
    expect(
      await resolveOffchainTokenMetadata(`0x${HASH}`, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).toBeNull();
  });

  it("accepts unverified bytes only when the operator opts in, and says so", async () => {
    process.env.TOKEN_METADATA_ALLOW_UNVERIFIED = "1";
    const fetchImpl = vi.fn(async () => new Response(forged, { status: 200, headers: { "content-type": "application/json" } }));
    const out = await resolveOffchainTokenMetadata(`0x${HASH}`, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(out).toMatchObject({ displayName: "Fake", verified: false });
  });

  it("does not query IPFS paths with a BLAKE3 digest", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await resolveOffchainTokenMetadata(`0x${HASH}`, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const urls = fetchImpl.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls.some((u) => u.includes("/ipfs/"))).toBe(false);
  });
});
