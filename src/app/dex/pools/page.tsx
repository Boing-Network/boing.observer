import type { Metadata } from "next";
import Link from "next/link";
import { HANDOFF_DEPENDENT_PROJECTS_URL, NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL, SITE_URL } from "@/lib/constants";
import { PoolsPanel } from "./pools-panel";

export const metadata: Metadata = {
  title: "Native DEX directory",
  description:
    "Read-only native constant-product pool directory from Boing RPC via boing-sdk — factory hints, pair counts, optional register_pair logs.",
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
          <li>
            <Link href="/tools" className="text-network-cyan hover:underline">
              Tools
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">DEX directory</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Native DEX directory
        </h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Bounded, read-only view aligned with{" "}
          <a
            href={HANDOFF_DEPENDENT_PROJECTS_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            HANDOFF-DEPENDENT-PROJECTS
          </a>{" "}
          (Observer §3). Uses <code className="rounded bg-white/10 px-1 text-sm">boing-sdk</code>{" "}
          <code className="rounded bg-white/10 px-1 text-sm">fetchNativeDexDirectorySnapshot</code> on the server
          (same configured RPC as the rest of the explorer). An optional Worker directory API (
          <code className="rounded bg-white/10 px-1 text-sm">GET /v1/directory/meta</code>,{" "}
          <code className="rounded bg-white/10 px-1 text-sm">/v1/directory/pools</code>) is documented in{" "}
          <a
            href={NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN
          </a>{" "}
          for teams that want pagination without walking RPC logs.
        </p>
        <p className="text-sm">
          <Link href="/tokens" className="text-network-cyan hover:underline">
            Token &amp; asset index
          </Link>
          {" · "}
          <Link href="/dex/quote" className="text-network-cyan hover:underline">
            CP route quotes →
          </Link>
        </p>
      </header>

      <PoolsPanel />
    </div>
  );
}
