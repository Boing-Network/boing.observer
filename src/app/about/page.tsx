import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, DOCS_BASE, QA_DOC_URL, RPC_SPEC_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Boing Network's six pillars: Security, Scalability, Decentralization, Authenticity, Transparency, and True Quality Assurance.",
  openGraph: {
    title: "About Boing Network | Boing Observer",
    description:
      "Six pillars: Security, Scalability, Decentralization, Authenticity, Transparency, True QA. Boing Network — Authentic. Decentralized. Optimal. Quality-Assured.",
  },
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
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
        <h1 className="page-title font-display">
          About Boing Network
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          <em>Authentic. Decentralized. Optimal. Quality-Assured.</em> — six pillars: Security, Scalability,
          Decentralization, Authenticity, Transparency, True QA.
        </p>
      </header>

      <section className="space-y-6" aria-labelledby="pillars-heading">
        <h2 id="pillars-heading" className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Six pillars
        </h2>
        <div className="space-y-6">
          <div className="glass-card p-5 sm:p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              1. Security
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Safety and correctness over speed. BFT consensus (HotStuff), Ed25519 + BLAKE3, RPC rate limiting, equivocation detection. Security advisories and incident response per{" "}
              <a
                href={`${DOCS_BASE}/SECURITY-STANDARDS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-network-cyan hover:underline"
              >
                SECURITY-STANDARDS
              </a>
              .
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              2. Scalability
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              High throughput without compromising other pillars. Parallel transfers, conflict-free scheduling, gas metering. Typical block time ~2 seconds; access-list batching enables parallel execution.
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              3. Decentralization
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Permissionless participation. No whitelist; anyone with stake can validate. P2P (libp2p) with live public bootnodes on testnet (<code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">/ip4/169.155.48.188/tcp/4001</code>, <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">/ip4/109.105.220.118/tcp/4001</code>); DHT on roadmap. No central gatekeeper for consensus, governance, or QA.
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              4. Authenticity
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Unique architecture and identity. Custom VM (stack-based, Boing opcodes), HotStuff BFT consensus, BLAKE3 + Ed25519, independent L1 — not a fork or framework.
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              5. Transparency
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              100% openness. Open source, public specs, account proof APIs, human-readable signing. QA rejections include <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">rule_id</code> and <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">message</code> for structured feedback. The explorer publishes a live{" "}
              <Link href="/qa" className="text-network-cyan hover:underline">QA transparency</Link>{" "}
              dashboard (pool queue and governance parameters from public RPC).
            </p>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              6. True quality assurance
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Protocol-enforced QA: only assets meeting rules and security bar are allowed. Meme leniency; no malice. Every deployment is classified as{" "}
              <strong className="text-[var(--text-primary)]">allow</strong>, <strong className="text-[var(--text-primary)]">reject</strong>, or{" "}
              <strong className="text-[var(--text-primary)]">unsure</strong>. Unsure cases are routed to the{" "}
              <strong className="text-[var(--text-primary)]">community QA pool</strong> for review. Opcode whitelist, well-formedness, bytecode blocklist, deploy metadata content policy, scam patterns, and purpose declaration are part of the check. See{" "}
              <a
                href={QA_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-network-cyan hover:underline"
              >
                Quality assurance rules and guidance
              </a>{" "}
              for the current policy and canonical malice definition. See live pool status on{" "}
              <Link href="/qa" className="text-network-cyan hover:underline">QA transparency</Link>{" "}
              and machine-readable details in{" "}
              <a href={RPC_SPEC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">RPC-API-SPEC</a>.
            </p>
          </div>
        </div>
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
          . <Link href="/" className="text-network-cyan hover:underline">Home</Link>
        </p>
      </section>
    </article>
  );
}
