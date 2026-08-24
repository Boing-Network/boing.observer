import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PdfDocument } from "./pdf-document";

describe("PdfDocument", () => {
  it("embeds the PDF and offers download/open links", () => {
    const html = renderToStaticMarkup(
      createElement(PdfDocument, {
        src: "/pdfs/SIX-PILLARS.pdf",
        title: "Six pillars",
        fileName: "SIX-PILLARS.pdf",
      })
    );
    expect(html).toContain("/pdfs/SIX-PILLARS.pdf");
    expect(html).toContain("Download PDF");
    expect(html).toContain('type="application/pdf"');
    expect(html).toContain("SIX-PILLARS.pdf");
  });
});
