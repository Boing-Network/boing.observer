import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { TokensIndexPanel } from "./tokens-index-panel";

export const metadata: Metadata = {
  title: "Token & asset index",
  description:
    "Discover Boing assets: scan recent blocks for deploys and DEX register_pair logs, with optional on-disk snapshot cache between requests.",
  alternates: { canonical: `${SITE_URL}/tokens` },
};

export default function TokensIndexPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2 text-[var(--text-muted)]">
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Token &amp; asset index
        </h1>
        <p className="max-w-3xl text-[var(--text-secondary)] leading-relaxed">
          Built from your selected RPC: successful contract deployments (parseable new account id in receipt return data)
          plus token accounts from native DEX{" "}
          <code className="rounded bg-white/10 px-1 text-sm">register_pair</code> logs. Each{" "}
          <code className="rounded bg-white/10 px-1 text-sm">network + block window</code> snapshot is written to disk
          (default <code className="rounded bg-white/10 px-1 text-sm">.cache/token-index</code>, TTL{" "}
          <code className="rounded bg-white/10 px-1 text-sm">TOKEN_INDEX_CACHE_TTL_SEC</code>, default 600s) so repeat loads
          do not re-walk the chain until expiry or <strong className="text-[var(--text-primary)]">Rescan</strong>. That is
          still not OBS-1: use a dedicated indexer for reorg-safe, planet-scale history.
        </p>
        <p className="text-sm">
          <Link href="/dex/tokens" className="text-network-cyan hover:underline">
            DEX token directory (RPC)
          </Link>
          {" · "}
          <Link href="/dex/pools" className="text-network-cyan hover:underline">
            DEX directory
          </Link>
          {" · "}
          <Link href="/tools" className="text-network-cyan hover:underline">
            Tools
          </Link>
        </p>
      </header>

      <TokensIndexPanel />
    </div>
  );
}
