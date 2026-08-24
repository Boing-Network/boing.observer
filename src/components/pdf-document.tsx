/**
 * In-page PDF for written docs (six pillars, essentials, specs).
 *
 * Native `<object>` / `<iframe>` embeds fail on this host: Cloudflare sends
 * `X-Frame-Options: DENY` on `/pdfs/*` (alongside SAMEORIGIN), and several
 * browsers have no PDF plugin. pdf.js paints pages to canvas/images instead,
 * so the document is readable without framing the PDF.
 */
"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "ready" | "error";

export function PdfDocument({
  src,
  title,
  fileName,
}: {
  src: string;
  title: string;
  fileName?: string;
}) {
  const downloadName = fileName ?? src.split("/").pop()?.split("?")[0] ?? "document.pdf";
  const href = src;
  const [status, setStatus] = useState<Status>("loading");
  const [pages, setPages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      setStatus("loading");
      setPages([]);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url: href, withCredentials: false }).promise;
        const scale = Math.min(2, (window.devicePixelRatio || 1) * 1.25);
        const urls: string[] = [];
        for (let i = 1; i <= doc.numPages; i += 1) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          urls.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) {
          setPages(urls);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [href]);

  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-boing-black/50">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
        <span className="font-display text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="flex flex-wrap gap-2">
          <a
            href={href}
            download={downloadName}
            className="rounded-lg bg-network-cyan px-3 py-1.5 text-sm font-semibold text-boing-black hover:bg-network-cyan-light"
          >
            Download PDF
          </a>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            Open
          </a>
        </span>
      </figcaption>
      <div className="max-h-[min(80vh,880px)] overflow-y-auto bg-[#f7f5f0]">
        {status === "loading" ? (
          <p className="p-6 text-sm text-slate-700">Loading {title}…</p>
        ) : null}
        {status === "error" ? (
          <p className="p-6 text-sm text-slate-700">
            This browser could not render the PDF inline.{" "}
            <a href={href} className="text-teal-700 underline" download={downloadName}>
              Download {title}
            </a>
            .
          </p>
        ) : null}
        {pages.map((pageSrc, index) => (
          <img
            key={`${href}-${index}`}
            src={pageSrc}
            alt={`${title}, page ${index + 1} of ${pages.length}`}
            className="mx-auto block h-auto w-full max-w-full border-b border-slate-200 last:border-b-0"
          />
        ))}
      </div>
    </figure>
  );
}
