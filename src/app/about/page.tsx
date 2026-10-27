import type { Metadata } from "next";
import Link from "next/link";
import { PdfDocument } from "@/components/pdf-document";
import { SITE_URL, QA_DOC_URL, WEBSITE_URL, WALLET_URL, FINANCE_URL } from "@/lib/constants";
import { publicPdfSrc } from "@/lib/public-pdf";
import { BRAND } from "@/lib/brand";
import { TestnetStatus } from "@/components/testnet-status";

export const metadata: Metadata = {
  title: "About",
  description:
    "Boing is an independent Layer 1 where quality is enforced by the protocol. Boing Observer is the explorer and transparency layer. Public testnet — mainnet not live.",
  openGraph: {
    title: "About Boing Network | Boing Observer",
    description:
      "Quality, enforced by the protocol. See how Boing Network, Boing Express, Boing Observer, and Boing Finance fit together.",
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

      <header className="space-y-3">
        <h1 className="page-title font-display">About Boing Network</h1>
        <p className="text-lg text-[var(--text-primary)]">{BRAND.tagline}</p>
        <TestnetStatus />
        <p className="max-w-2xl leading-relaxed text-[var(--text-secondary)]">{BRAND.core}</p>
        <p className="max-w-2xl leading-relaxed text-[var(--text-secondary)]">{BRAND.promise}</p>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {BRAND.verifiability} {BRAND.testnetStatus} is the current public state, and the records on this explorer are
          what you can check.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="products-heading">
        <h2 id="products-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Where to look
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="glass-card p-4">
            <h3 className="font-display font-semibold text-[var(--text-primary)]">{BRAND.networkName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{BRAND.networkLine}. {BRAND.primaryMessage}</p>
            <a href={WEBSITE_URL} className="mt-2 inline-block text-sm text-network-cyan hover:underline">
              boing.network
            </a>
          </li>
          <li className="glass-card p-4">
            <h3 className="font-display font-semibold text-[var(--text-primary)]">{BRAND.expressName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{BRAND.expressLine}.</p>
            <a href={WALLET_URL} className="mt-2 inline-block text-sm text-network-cyan hover:underline">
              boing.express
            </a>
          </li>
          <li className="glass-card p-4">
            <h3 className="font-display font-semibold text-[var(--text-primary)]">{BRAND.observerName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {BRAND.observerLine}. {BRAND.observerBoundary}
            </p>
            <Link href="/" className="mt-2 inline-block text-sm text-network-cyan hover:underline">
              This explorer
            </Link>
          </li>
          <li className="glass-card p-4">
            <h3 className="font-display font-semibold text-[var(--text-primary)]">{BRAND.financeName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{BRAND.financeLine}.</p>
            <a href={FINANCE_URL} className="mt-2 inline-block text-sm text-network-cyan hover:underline">
              boing.finance
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="audiences-heading">
        <h2 id="audiences-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Who this is for
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          <li>
            <strong className="text-[var(--text-primary)]">People using the chain</strong> can look up accounts, blocks,
            and transactions.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Developers</strong> can read deployment QA status and the
            published rules before they submit.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">Validators and node operators</strong> can see participation
            and endpoint health against the same public rules.
          </li>
        </ul>
      </section>

      <section className="glass-card space-y-3 p-5 sm:p-6" aria-labelledby="gate-heading">
        <h2 id="gate-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          {BRAND.qualityGateName}
        </h2>
        <p className="leading-relaxed text-[var(--text-secondary)]">{BRAND.qualityGateSummary}</p>
        <p className="leading-relaxed text-[var(--text-secondary)]">
          {BRAND.transparentDefault} {BRAND.outcomesVisible}
        </p>
        <p className="leading-relaxed text-[var(--text-secondary)]">{BRAND.reduceMalicious}</p>
        <p className="leading-relaxed text-[var(--text-secondary)]">{BRAND.protocolChecks}</p>
        <p className="text-sm">
          <Link href="/qa" className="text-network-cyan hover:underline">
            Open the Quality Gate
          </Link>
          {" · "}
          <Link href="/qa/rules" className="text-network-cyan hover:underline">
            Read the rules
          </Link>
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="pillars-heading">
        <h2 id="pillars-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Six pillars
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Full written source on GitHub:{" "}
          <a
            href="https://github.com/Boing-Network/boing.network/blob/main/docs/SIX-PILLARS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            Six pillars
          </a>
          .
        </p>
        <PdfDocument src={publicPdfSrc("SIX-PILLARS.pdf")} title="Six pillars" fileName="SIX-PILLARS.pdf" />
      </section>

      <section className="space-y-4" aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Documentation
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Explorer pages show what happened on-chain. Specs, method names, and operator notes live in the links below.
          The six-pillars PDF is a published network document; the lines above are the current product language.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/qa/rules"
              className="block rounded-xl border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-sm text-network-cyan hover:border-network-cyan/50"
            >
              Boing Quality Gate rules (catalog + PDF)
            </Link>
          </li>
          <li>
            <Link
              href="/tools/rpc-catalog"
              className="block rounded-xl border border-[var(--border-color)] bg-boing-navy-mid/40 px-4 py-3 text-sm text-network-cyan hover:border-network-cyan/50"
            >
              Live RPC method catalog
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
          Live QA pool:{" "}
          <Link href="/qa" className="text-network-cyan hover:underline">
            Quality Gate
          </Link>
          . Policy source:{" "}
          <a href={QA_DOC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            Quality Assurance Network
          </a>
          .
        </p>
      </section>

      <section className="glass-card p-5 sm:p-6" aria-labelledby="explorer-heading">
        <h2 id="explorer-heading" className="mb-3 font-display text-xl font-semibold text-[var(--text-primary)]">
          This explorer
        </h2>
        <p className="leading-relaxed text-[var(--text-secondary)]">
          {BRAND.observerBoundary} Search by block height, transaction, or account address. Use{" "}
          <Link href="/tools" className="text-network-cyan hover:underline">
            Tools
          </Link>{" "}
          for builder helpers, or return{" "}
          <Link href="/" className="text-network-cyan hover:underline">
            Home
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
