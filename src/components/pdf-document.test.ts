import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PdfDocument } from "./pdf-document";

describe("PdfDocument", () => {
  it("offers download/open links while pages render on the client", () => {
    const html = renderToStaticMarkup(
      createElement(PdfDocument, {
        src: "/pdfs/SIX-PILLARS.pdf?v=test",
        title: "Six pillars",
        fileName: "SIX-PILLARS.pdf",
      })
    );
    expect(html).toContain("/pdfs/SIX-PILLARS.pdf?v=test");
    expect(html).toContain("Download PDF");
    expect(html).toContain("Open");
    expect(html).toContain("SIX-PILLARS.pdf");
    expect(html).toContain("Loading Six pillars");
  });
});
