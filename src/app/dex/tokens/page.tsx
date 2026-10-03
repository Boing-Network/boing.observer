import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { TechnicalDetails } from "@/components/technical-details";
import { DexTokensPanel } from "./dex-tokens-panel";

export const metadata: Metadata = {
  title: "DEX token directory",
  description: "Tokens that appear in registered native DEX pools on the selected Boing network.",
  alternates: { canonical: `${SITE_URL}/dex/tokens` },
};

export default function DexTokensPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">DEX tokens</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="page-title font-display">DEX token directory</h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Tokens that appear in at least one registered pool. If no factory is published on this network, the list stays
          empty. Newly deployed tokens show on the{" "}
          <Link href="/tokens" className="text-network-cyan hover:underline">
            token index
          </Link>{" "}
          once included in a block — DEX listing comes after a pair is registered.
        </p>
        <p className="text-sm">
          <Link href="/dex/pools" className="text-network-cyan hover:underline">
            DEX pools
          </Link>
          {" · "}
          <Link href="/dex/quote" className="text-network-cyan hover:underline">
            Quotes
          </Link>
        </p>
        <TechnicalDetails summary="Technical details">
          <p>
            Data follows the network&apos;s canonical native DEX factory. See{" "}
            <Link href="/tools/rpc-catalog" className="text-network-cyan hover:underline">
              RPC catalog
            </Link>{" "}
            and{" "}
            <Link href="/about" className="text-network-cyan hover:underline">
              About
            </Link>{" "}
            for method and integration references.
          </p>
        </TechnicalDetails>
      </header>

      <DexTokensPanel />
    </div>
  );
}
