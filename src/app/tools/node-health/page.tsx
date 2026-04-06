import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { NodeHealthPanel } from "./node-health-panel";

export const metadata: Metadata = {
  title: "Node health & sync",
  description:
    "Compare boing_chainHeight, boing_getSyncState, and boing_health on the selected Boing JSON-RPC endpoint.",
  alternates: { canonical: `${SITE_URL}/tools/node-health` },
};

export default function NodeHealthPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2 text-[var(--text-muted)]">
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
          <li className="text-[var(--text-primary)]">Node health</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Node health &amp; sync
        </h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Operator-facing snapshot: committed tip via <code className="rounded bg-white/10 px-1 text-sm">boing_getSyncState</code>,{" "}
          <code className="rounded bg-white/10 px-1 text-sm">boing_chainHeight</code>, and optional{" "}
          <code className="rounded bg-white/10 px-1 text-sm">boing_health</code> (limits + metrics when exposed).
        </p>
      </header>

      <NodeHealthPanel />
    </div>
  );
}
