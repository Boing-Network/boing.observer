import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { QuotePanel } from "./quote-panel";

export const metadata: Metadata = {
  title: "Native DEX route quotes",
  description:
    "Read-only constant-product route quotes via boing-sdk fetchCpRoutingFromDirectoryLogs — exploratory; execution stays in wallets and dApps.",
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
          <li>
            <Link href="/tools" className="text-network-cyan hover:underline">
              Tools
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">DEX quotes</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Native DEX route quotes
        </h1>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Uses <code className="rounded bg-white/10 px-1 text-sm">boing-sdk</code>{" "}
          <code className="rounded bg-white/10 px-1 text-sm">findBestCpRoutes</code> over hydrated pools. For execution
          calldata and wallet flow, use the tutorial CLIs and Boing Express — see the network monorepo handoff doc.
        </p>
      </header>

      <QuotePanel />
    </div>
  );
}
