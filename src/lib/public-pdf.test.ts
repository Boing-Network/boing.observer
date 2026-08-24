import { describe, expect, it } from "vitest";
import { publicPdfSrc } from "./public-pdf";

describe("publicPdfSrc", () => {
  it("appends a content hash when the PDF exists", () => {
    const src = publicPdfSrc("SIX-PILLARS.pdf");
    expect(src).toMatch(/^\/pdfs\/SIX-PILLARS\.pdf\?v=[0-9a-f]{10}$/);
  });
});
