import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, DOCS_BASE, NETWORK_FAUCET_URL, QA_DOC_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Boing Network's six pillars: Security, Scalability, Decentralization, Authenticity, Transparency, and True Quality Assurance.",
  openGraph: {
    title: "About Boing Network | Boing Observer",
    description:
      "Six pillars: Security, Scalability, Decentralization, Authenticity, Transparency, True QA. Boing Network — Authentic. Decentralized. Optimal. Sustainable.",
  },
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};

export default function AboutPage() {
  return (
    <div className="space-y-10 max-w-3xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol
          className="flex items-center gap-2 text-[var(--text-muted)]"
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          About Boing Network
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Boing Network — <em>Authentic. Decentralized. Optimal. Sustainable.</em>
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Six pillars guide design and operations: Security, Scalability, Decentralization, Authenticity, Transparency, True Quality Assurance.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Six pillars
        </h2>
        <div className="space-y-6">
          <div className="glass-card p-6">
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

          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              2. Scalability
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              High throughput without compromising other pillars. Parallel transfers, conflict-free scheduling, gas metering. Typical block time ~2 seconds; access-list batching enables parallel execution.
            </p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              3. Decentralization
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Permissionless participation. No whitelist; anyone with stake can validate. P2P (libp2p), bootnodes, DHT (roadmap). No central gatekeeper for consensus, governance, or QA.
            </p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              4. Authenticity
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Unique architecture and identity. Custom VM (stack-based, Boing opcodes), HotStuff BFT consensus, BLAKE3 + Ed25519, independent L1 — not a fork or framework.
            </p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              5. Transparency
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              100% openness. Open source, public specs, account proof APIs, human-readable signing. QA rejections include <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">rule_id</code> and <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">message</code> for structured feedback.
            </p>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-display font-semibold text-network-cyan mb-2">
              6. True quality assurance
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Protocol-enforced QA: only assets meeting rules and security bar are allowed. Meme leniency; no malice. Every deployment is classified as{" "}
              <strong className="text-[var(--text-primary)]">allow</strong>, <strong className="text-[var(--text-primary)]">reject</strong>, or{" "}
              <strong className="text-[var(--text-primary)]">unsure</strong>. Unsure cases are routed to the{" "}
              <strong className="text-[var(--text-primary)]">community QA pool</strong> for review. Opcode whitelist, well-formedness, blocklist, scam patterns, and purpose declaration are part of the check. See{" "}
              <a
                href={QA_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-network-cyan hover:underline"
              >
                Quality assurance rules and guidance
              </a>{" "}
              for the current policy and canonical malice definition.
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">
          Boing Observer
        </h2>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Boing Observer is the official blockchain explorer for Boing Network. Search by block height, block hash, or account address. Browse Boing testnet today, with mainnet support enabled when a distinct mainnet RPC is configured. Use the{" "}
          <Link href="/tools/qa-check" className="text-network-cyan hover:underline">QA Check</Link>{" "}
          tool to verify bytecode before deployment, and the <Link href="/faucet" className="text-network-cyan hover:underline">Faucet helper</Link> for direct testnet RPC requests. For the canonical public faucet and onboarding flow, see{" "}
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            boing.network/network/faucet
          </a>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-network-cyan hover:text-network-cyan-light font-medium transition-colors"
          >
            Explore the blockchain →
          </Link>
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-network-cyan hover:text-network-cyan-light font-medium transition-colors"
          >
            Public faucet →
          </a>
          <Link
            href="/tools/qa-check"
            className="inline-flex items-center gap-2 text-network-cyan hover:text-network-cyan-light font-medium transition-colors"
          >
            QA Check tool →
          </Link>
          <Link
            href="/faucet"
            className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
          >
            Faucet helper →
          </Link>
        </div>
      </section>
    </div>
  );
}
