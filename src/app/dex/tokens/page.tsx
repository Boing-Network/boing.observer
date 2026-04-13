import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { DexTokensPanel } from "./dex-tokens-panel";

export const metadata: Metadata = {
  title: "DEX token directory",
  description:
    "Cursor-paginated DEX-derived token universe from boing_listDexTokens (boing-sdk) using the network canonical native DEX factory.",
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
          <li>
            <Link href="/tools" className="text-network-cyan hover:underline">
              Tools
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">DEX tokens</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">DEX token directory</h1>
        <p className="max-w-3xl text-[var(--text-secondary)] leading-relaxed">
          Tokens that appear in at least one pool under the canonical factory from{" "}
          <code className="rounded bg-white/10 px-1 text-sm">boing_getNetworkInfo.end_user.canonical_native_dex_factory</code>
          . Data is served by <code className="rounded bg-white/10 px-1 text-sm">boing_listDexTokens</code> via{" "}
          <code className="rounded bg-white/10 px-1 text-sm">boing-sdk</code> on the server (same RPC as the rest of the
          explorer). This is the trade-relevant universe — distinct from the block-scan{" "}
          <Link href="/tokens" className="text-network-cyan hover:underline">
            token index
          </Link>
          .
        </p>
        <p className="text-sm">
          <Link href="/dex/pools" className="text-network-cyan hover:underline">
            DEX pools &amp; directory
          </Link>
          {" · "}
          <Link href="/dex/quote" className="text-network-cyan hover:underline">
            CP quotes
          </Link>
        </p>
      </header>

      <DexTokensPanel />
    </div>
  );
}
