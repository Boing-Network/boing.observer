import type { Metadata } from "next";
import Link from "next/link";
import {
  HANDOFF_DEPENDENT_PROJECTS_URL,
  NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL,
  SITE_URL,
} from "@/lib/constants";
import { TechnicalDetails } from "@/components/technical-details";
import { PoolsPanel } from "./pools-panel";

export const metadata: Metadata = {
  title: "Native DEX directory",
  description: "Browse native Boing liquidity pools and factory contracts on the selected network.",
  alternates: { canonical: `${SITE_URL}/dex/pools` },
};

export default function DexPoolsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">DEX pools</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="page-title font-display">Native DEX directory</h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Browse native pools and factory contracts for this network — reserves, fees, and pair listings when a factory
          is published.
        </p>
        <p className="text-sm">
          <Link href="/tokens" className="text-network-cyan hover:underline">
            Token index
          </Link>
          {" · "}
          <Link href="/dex/tokens" className="text-network-cyan hover:underline">
            DEX tokens
          </Link>
          {" · "}
          <Link href="/dex/quote" className="text-network-cyan hover:underline">
            Quotes
          </Link>
        </p>
        <TechnicalDetails summary="For integrators">
          <p>
            Pool rows come from on-chain discovery for the network&apos;s canonical factory. Optional log scanning and
            indexer directory APIs are documented in{" "}
            <a
              href={HANDOFF_DEPENDENT_PROJECTS_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              dependent-project handoff
            </a>{" "}
            and{" "}
            <a
              href={NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              native DEX directory handoff
            </a>
            . Method catalog:{" "}
            <Link href="/tools/rpc-catalog" className="text-network-cyan hover:underline">
              RPC catalog
            </Link>
            .
          </p>
        </TechnicalDetails>
      </header>

      <PoolsPanel />
    </div>
  );
}
