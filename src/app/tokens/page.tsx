import type { Metadata } from "next";
import Link from "next/link";
import { OBSERVER_HOSTED_SERVICE_URL, SITE_URL } from "@/lib/constants";
import { TechnicalDetails } from "@/components/technical-details";
import { TokensIndexPanel } from "./tokens-index-panel";

export const metadata: Metadata = {
  title: "Token & asset index",
  description:
    "Browse recent Boing assets discovered from on-chain deploys and DEX listings on the selected network.",
  alternates: { canonical: `${SITE_URL}/tokens` },
};

export default function TokensIndexPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="breadcrumb-list text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">Tokens</li>
        </ol>
      </nav>

      <header className="space-y-3">
        <h1 className="page-title font-display">Token &amp; asset index</h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Recent assets from contract deploys and DEX listings on the selected network. A token only appears after its
          deploy is included in a block — not when it is merely submitted.
        </p>
        <p className="text-sm">
          <Link href="/dex/tokens" className="text-network-cyan hover:underline">
            DEX tokens
          </Link>
          {" · "}
          <Link href="/dex/pools" className="text-network-cyan hover:underline">
            DEX pools
          </Link>
          {" · "}
          <Link href="/about" className="text-network-cyan hover:underline">
            About &amp; docs
          </Link>
        </p>
        <TechnicalDetails summary="How this index is built">
          <p>
            Scans successful contract deployments in a recent block window and merges tokens from native DEX pair
            registrations when a factory is published. Snapshots may be cached briefly between requests; use Rescan for
            a fresh walk. Durable, reorg-safe history belongs in a hosted indexer — see{" "}
            <a
              href={OBSERVER_HOSTED_SERVICE_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              OBSERVER-HOSTED-SERVICE
            </a>
            .
          </p>
        </TechnicalDetails>
      </header>

      <TokensIndexPanel />
    </div>
  );
}
