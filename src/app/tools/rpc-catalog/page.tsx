import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, RPC_SPEC_URL } from "@/lib/constants";
import { RpcCatalogPanel } from "./rpc-catalog-panel";

export const metadata: Metadata = {
  title: "RPC method catalog",
  description:
    "Live boing_getRpcMethodCatalog snapshot from the selected network RPC — discover which JSON-RPC methods this endpoint exposes.",
  alternates: { canonical: `${SITE_URL}/tools/rpc-catalog` },
};

export default function RpcCatalogPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
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
          <li className="text-[var(--text-primary)]">RPC catalog</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          RPC method catalog
        </h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Calls <code className="rounded bg-white/10 px-1 text-sm">boing_getRpcMethodCatalog</code> on the RPC you have
          selected in the header. For the human-readable contract, see{" "}
          <a href={RPC_SPEC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
            RPC-API-SPEC.md
          </a>
          .
        </p>
      </header>

      <RpcCatalogPanel />
    </div>
  );
}
