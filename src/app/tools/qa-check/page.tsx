"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { QA_DOC_URL } from "@/lib/constants";
import { qaCheck, type QaCheckResult } from "@/lib/rpc-methods";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";

const VALID_PURPOSES = [
  "dApp",
  "dapp",
  "token",
  "NFT",
  "nft",
  "meme",
  "community",
  "entertainment",
  "tooling",
  "other",
];

export default function QaCheckPage() {
  const { network } = useNetwork();
  const [bytecode, setBytecode] = useState("");
  const [purpose, setPurpose] = useState("");
  const [descriptionHash, setDescriptionHash] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetSymbol, setAssetSymbol] = useState("");
  const [result, setResult] = useState<QaCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setResult(null);
    const hex = bytecode.trim();
    if (!hex) {
      setError("Enter hex bytecode (e.g. 0x600160005260206000f3)");
      return;
    }
    if ((assetName.trim() || assetSymbol.trim()) && !descriptionHash.trim()) {
      setError("Provide a description hash before sending asset name or symbol metadata.");
      return;
    }
    setLoading(true);
    try {
      const res = await qaCheck(
        network,
        hex,
        purpose || undefined,
        descriptionHash || undefined,
        assetName || undefined,
        assetSymbol || undefined
      );
      setResult(res);
    } catch (e) {
      setError(getFriendlyRpcErrorMessage(e, network, "general"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
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
          <li className="text-[var(--text-primary)]">QA pre-flight</li>
        </ol>
      </nav>

      <header>
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">QA pre-flight</h1>
        <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
          Dry-run <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">boing_qaCheck</code> before deploy. Optional
          fields mirror the live RPC parameter order.
        </p>
      </header>

      <form className="glass-card space-y-4 p-4 sm:p-6" onSubmit={(e) => void handleCheck(e)} noValidate>
        <div>
          <label htmlFor="bytecode" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Hex bytecode (required)
          </label>
          <textarea
            id="bytecode"
            name="bytecode"
            value={bytecode}
            onChange={(e) => setBytecode(e.target.value)}
            placeholder="0x600160005260206000f3"
            rows={4}
            className="w-full font-mono text-sm p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
          />
        </div>
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Purpose category (optional; recommended)
          </label>
          <select
            id="purpose"
            name="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full max-w-xs p-2 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
          >
            <option value="">—</option>
            {VALID_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description-hash" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Description hash (optional)
          </label>
          <input
            id="description-hash"
            name="description-hash"
            type="text"
            value={descriptionHash}
            onChange={(e) => setDescriptionHash(e.target.value)}
            placeholder="0x..."
            className="w-full font-mono text-sm p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="asset-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Asset name (optional)
            </label>
            <input
              id="asset-name"
              name="asset-name"
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="Boing Token"
              className="w-full p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
            />
          </div>
          <div>
            <label htmlFor="asset-symbol" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Asset symbol (optional)
            </label>
            <input
              id="asset-symbol"
              name="asset-symbol"
              type="text"
              value={assetSymbol}
              onChange={(e) => setAssetSymbol(e.target.value)}
              placeholder="BOING"
              className="w-full p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-network-cyan px-4 py-2 font-semibold text-boing-black hover:bg-network-cyan-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking…" : "Check"}
        </button>
      </form>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      {result && (
        <output
          className={`block glass-card p-6 ${
            result.result === "allow"
              ? "border-green-500/40 bg-green-950/20"
              : result.result === "reject"
                ? "border-red-500/40 bg-red-950/20"
                : "border-amber-500/40 bg-amber-950/20"
          }`}
          aria-live="polite"
        >
          <h2 className="mb-2 font-display text-lg font-semibold text-[var(--text-primary)]">
            Result: {result.result.toUpperCase()}
          </h2>
          {result.rule_id && (
            <p className="text-sm">
              <span className="text-[var(--text-muted)]">rule_id:</span>{" "}
              <code className="px-1.5 py-0.5 rounded bg-white/10">{result.rule_id}</code>
            </p>
          )}
          {result.message && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{result.message}</p>
          )}
          {result.result === "reject" && (
            <p className="mt-3 text-sm">
              <a
                href={result.doc_url || QA_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-network-cyan hover:underline"
              >
                See canonical QA guidance →
              </a>
            </p>
          )}
          {result.result === "unsure" && (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              This deployment would go to the community QA pool for review.
            </p>
          )}
        </output>
      )}

      <footer className="text-sm text-[var(--text-muted)]">
        Policy:{" "}
        <a href={QA_DOC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
          QA docs
        </a>
        {" · "}
        <Link href="/qa" className="text-network-cyan hover:underline">
          Pool status
        </Link>
      </footer>
    </div>
  );
}
