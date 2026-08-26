import type { Metadata } from "next";
import Link from "next/link";
import { PdfDocument } from "@/components/pdf-document";
import { SITE_URL, QA_DOC_URL } from "@/lib/constants";
import { publicPdfSrc } from "@/lib/public-pdf";

export const metadata: Metadata = {
  title: "About",
  description:
    "Boing Network six pillars as a PDF: Security, Scalability, Decentralization, Authenticity, Transparency, and True Quality Assurance.",
  openGraph: {
    title: "About Boing Network | Boing Observer",
    description:
      "Six pillars PDF — Security, Scalability, Decentralization, Authenticity, Transparency, True QA.",
  },
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-4xl space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol
          className="breadcrumb-list text-[var(--text-muted)]"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <Link href="/" className="text-network-cyan hover:text-network-cyan-light hover:underline" itemProp="item">
              <span itemProp="name">Home</span>
            </Link>
            <meta itemProp="position" content="1" />
          </li>
          <li aria-hidden="true">/</li>
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <span className="text-[var(--text-primary)]" itemProp="name">About</span>
            <meta itemProp="position" content="2" />
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="page-title font-display">About Boing Network</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          <em>Authentic. Decentralized. Optimal. Quality-Assured.</em> Written network documents are published as PDFs.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="pillars-heading">
        <h2 id="pillars-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Six pillars
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Canonical source:{" "}
          <a
            href="https://github.com/Boing-Network/boing.network/blob/main/docs/SIX-PILLARS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            docs/SIX-PILLARS.md
          </a>
          .
        </p>
        <PdfDocument src={publicPdfSrc("SIX-PILLARS.pdf")} title="Six pillars" fileName="SIX-PILLARS.pdf" />
      </section>

      <section className="space-y-4" aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Related PDFs
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/qa/rules"
              className="block rounded-xl border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-sm text-network-cyan hover:border-network-cyan/50"
            >
              QA gate rules (PDF + catalog)
            </Link>
          </li>
          <li>
            <a
              href="https://boing.network/pdfs/BOING-NETWORK-ESSENTIALS.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-sm text-network-cyan hover:border-network-cyan/50"
            >
              Network essentials (PDF)
            </a>
          </li>
          <li>
            <a
              href="https://boing.network/pdfs/QUALITY-ASSURANCE-NETWORK.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-sm text-network-cyan hover:border-network-cyan/50"
            >
              Quality assurance (PDF)
            </a>
          </li>
        </ul>
        <p className="text-sm text-[var(--text-muted)]">
          Live pool status:{" "}
          <Link href="/qa" className="text-network-cyan hover:underline">
            QA transparency
          </Link>
          . Policy source:{" "}
          <a href={QA_DOC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            QUALITY-ASSURANCE-NETWORK.md
          </a>
          .
        </p>
      </section>

      <section className="glass-card p-5 sm:p-6" aria-labelledby="explorer-heading">
        <h2 id="explorer-heading" className="mb-3 font-display text-xl font-semibold text-[var(--text-primary)]">
          This explorer
        </h2>
        <p className="leading-relaxed text-[var(--text-secondary)]">
          Search by height, 64-character hex (tx id, block hash, or account), or use{" "}
          <Link href="/tools" className="text-network-cyan hover:underline">
            Tools
          </Link>
          .{" "}
          <Link href="/" className="text-network-cyan hover:underline">
            Home
          </Link>
        </p>
      </section>
    </article>
  );
}
