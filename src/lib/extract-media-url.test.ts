import { describe, expect, it } from "vitest";
import {
  formatAssetDisplayLabel,
  parseAssetDisplayMetadata,
  resolveImageUrlFromSources,
} from "./extract-media-url";

describe("parseAssetDisplayMetadata", () => {
  it("keeps plain name and symbol", () => {
    expect(parseAssetDisplayMetadata("Boing Frog", "FROG")).toEqual({
      displayName: "Boing Frog",
      displaySymbol: "FROG",
      imageUrl: null,
      description: null,
    });
  });

  it("reads OpenSea-style JSON from asset_name", () => {
    const json = JSON.stringify({
      name: "Coral Reef #3",
      symbol: "REEF",
      image: "ipfs://QmDemoArt",
      description: "A reef tile",
    });
    expect(parseAssetDisplayMetadata(json, "NFT")).toEqual({
      displayName: "Coral Reef #3",
      displaySymbol: "REEF",
      imageUrl: "https://ipfs.io/ipfs/QmDemoArt",
      description: "A reef tile",
    });
  });

  it("treats a bare image URL as media, not the title", () => {
    const url = "https://cdn.example.com/token.png";
    expect(parseAssetDisplayMetadata(url, "TOK")).toEqual({
      displayName: null,
      displaySymbol: "TOK",
      imageUrl: url,
      description: null,
    });
  });

  it("does not treat a name that mentions a URL as an image", () => {
    const meta = parseAssetDisplayMetadata("Docs at https://boing.network/about", "DOC");
    expect(meta.displayName).toBe("Docs at https://boing.network/about");
    expect(meta.imageUrl).toBeNull();
  });
});

  it("reads nested properties.files[].uri", () => {
    expect(
      resolveImageUrlFromSources(
        JSON.stringify({
          properties: { files: [{ uri: "https://cdn.example.com/nested.png", type: "image/png" }] },
        }),
      ),
    ).toBe("https://cdn.example.com/nested.png");
  });

describe("formatAssetDisplayLabel", () => {
  it("joins name and symbol", () => {
    expect(
      formatAssetDisplayLabel({
        displayName: "Coral",
        displaySymbol: "REEF",
        imageUrl: null,
        description: null,
      }),
    ).toBe("Coral · REEF");
  });

  it("falls back when metadata is only an image URL", () => {
    expect(
      formatAssetDisplayLabel({
        displayName: null,
        displaySymbol: null,
        imageUrl: "https://cdn.example.com/x.png",
        description: null,
      }),
    ).toBe("Unnamed");
  });
});
