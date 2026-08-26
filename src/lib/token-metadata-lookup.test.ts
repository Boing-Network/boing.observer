import { describe, expect, it, vi } from "vitest";
import { descriptionHashToHex64, resolveOffchainTokenMetadata } from "./token-metadata-lookup";

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
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          schema: "boing.token_launch_metadata.v1",
          name: "Pugs On The Block",
          symbol: "POTB",
          image: "https://cdn.example.com/pug.png",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const found = await resolveOffchainTokenMetadata(`0x${HASH}`, { fetchImpl: fetchImpl as unknown as typeof fetch });
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
