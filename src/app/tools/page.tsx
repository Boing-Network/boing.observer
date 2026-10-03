import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, NETWORK_FAUCET_URL, RPC_SPEC_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Developer tools",
  description:
    "Boing Observer utilities: faucet helper, node health, RPC catalog, QA pre-flight, token and DEX directories.",
  alternates: { canonical: `${SITE_URL}/tools` },
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="breadcrumb-list text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">Tools</li>
        </ol>
      </nav>

      <header>
        <h1 className="page-title font-display">Developer tools</h1>
        <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
          Helpers for builders and operators. Everyday onboarding:{" "}
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            testnet faucet
          </a>
          . Specs live under{" "}
          <Link href="/about" className="text-network-cyan hover:underline">
            About
          </Link>{" "}
          and the{" "}
          <a href={RPC_SPEC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            RPC API spec
          </a>
          .
        </p>
      </header>

      <nav aria-labelledby="tools-nav-heading">
        <p id="tools-nav-heading" className="sr-only">
          Available tools
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/faucet"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">Faucet helper</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Request testnet BOING for an account on the selected network.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/tools/node-health"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">Node health &amp; sync</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Tip height, sync state, and optional node health metrics.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/tools/rpc-catalog"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">RPC method catalog</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                See which JSON-RPC methods the selected endpoint exposes.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/tools/qa-check"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">QA pre-flight</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Check bytecode against live deploy QA rules before submitting.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/qa/rules"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">QA gate rules</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Full Allow / Reject / Unsure catalog and downloadable PDF.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/tokens"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">Token &amp; asset index</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Browse recent deploys and listed assets on the selected network.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/dex/tokens"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">DEX token directory</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Tokens that appear in registered native DEX pools.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/dex/pools"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">Native DEX directory</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Factory contracts, pools, and pair listings for this network.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/dex/quote"
              className="glass-card block h-full p-5 transition-colors hover:border-[var(--border-hover)]"
            >
              <h2 className="font-display text-lg font-semibold text-network-cyan">DEX route quotes</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                Preview read-only swap routes; execution stays in wallets and dApps.
              </p>
            </Link>
          </li>
        </ul>
      </nav>

      <p className="text-sm text-[var(--text-muted)]">
        Live pool:{" "}
        <Link href="/qa" className="text-network-cyan hover:underline">
          QA transparency
        </Link>
      </p>
    </div>
  );
}
