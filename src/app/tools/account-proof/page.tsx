import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { BRAND } from "@/lib/brand";
import { AccountProofPanel } from "./account-proof-panel";

export const metadata: Metadata = {
  title: "Account proof",
  description:
    "Fetch a Merkle proof for an account (boing_getAccountProof), verify it (boing_verifyAccountProof) and anchor its root to a recent block state root.",
  alternates: { canonical: `${SITE_URL}/tools/account-proof` },
};

export default function AccountProofPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="breadcrumb-list text-[var(--text-muted)]">
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
          <li className="text-[var(--text-primary)]">Account proof</li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="page-title font-display">Account proof</h1>
        <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Fetch a Merkle proof for an account, have the node verify it, and check that its root equals the state root
          of a recent block. {BRAND.verifiability}
        </p>
      </header>

      <AccountProofPanel />
    </div>
  );
}