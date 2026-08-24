/**
 * In-page PDF for written docs (six pillars, essentials, specs).
 * Prefer same-origin `/pdfs/*.pdf` so the embed is not blocked by framing headers.
 */

export function PdfDocument({
  src,
  title,
  fileName,
}: {
  src: string;
  title: string;
  fileName?: string;
}) {
  const downloadName = fileName ?? src.split("/").pop() ?? "document.pdf";
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-boing-black/50">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
        <span className="font-display text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="flex flex-wrap gap-2">
          <a
            href={src}
            download={downloadName}
            className="rounded-lg bg-network-cyan px-3 py-1.5 text-sm font-semibold text-boing-black hover:bg-network-cyan-light"
          >
            Download PDF
          </a>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            Open
          </a>
        </span>
      </figcaption>
      <object
        data={`${src}#toolbar=1&navpanes=0&view=FitH`}
        type="application/pdf"
        className="block h-[min(80vh,880px)] w-full bg-[#0a0e14]"
        aria-label={title}
      >
        <p className="p-6 text-sm text-[var(--text-secondary)]">
          This browser cannot display PDFs inline.{" "}
          <a href={src} className="text-network-cyan hover:underline" download={downloadName}>
            Download {title}
          </a>
          .
        </p>
      </object>
    </figure>
  );
}
