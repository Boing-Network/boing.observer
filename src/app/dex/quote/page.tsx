import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { TechnicalDetails } from "@/components/technical-details";
import { QuotePanel } from "./quote-panel";

export const metadata: Metadata = {
  title: "Native DEX route quotes",
  description: "Preview read-only constant-product swap routes on Boing. Execution stays in wallets and dApps.",
  alternates: { canonical: `${SITE_URL}/dex/quote` },
};

export default function DexQuotePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">DEX quotes</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="page-title font-display">Native DEX route quotes</h1>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Preview read-only swap routes across known pools. This explorer does not execute trades — use Boing Express or
          your dApp for that.
        </p>
        <TechnicalDetails summary="Technical details">
          <p>
            Quotes hydrate pools from the network DEX directory. For calldata and wallet flows, see the network monorepo
            handoffs and{" "}
            <Link href="/tools" className="text-network-cyan hover:underline">
              Tools
            </Link>
            .
          </p>
        </TechnicalDetails>
      </header>

      <QuotePanel />
    </div>
  );
}
