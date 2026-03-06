"use client";

import { useState } from "react";
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

  async function handleCheck() {
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
    <div className="space-y-8 max-w-2xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/about" className="text-network-cyan hover:underline">About</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">QA Check</li>
        </ol>
      </nav>

      <header>
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          QA Check — Pre-flight
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Verify bytecode against the protocol QA rules before submitting a deployment. Uses <code className="px-1.5 py-0.5 rounded bg-white/10 text-sm">boing_qaCheck</code>.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          This page supports the current runtime pre-flight shape: bytecode, optional purpose category, optional description hash, and optional asset metadata fields when your deploy flow uses them.
        </p>
      </header>

      <div className="glass-card p-6 space-y-4">
        <div>
          <label htmlFor="bytecode" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Hex bytecode (required)
          </label>
          <textarea
            id="bytecode"
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
            type="text"
            value={descriptionHash}
            onChange={(e) => setDescriptionHash(e.target.value)}
            placeholder="0x..."
            className="w-full font-mono text-sm p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
          />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Use when your deployment flow already includes a purpose description hash. This keeps the pre-flight request aligned with the current Boing QA docs.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="asset-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Asset name (optional)
            </label>
            <input
              id="asset-name"
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
              type="text"
              value={assetSymbol}
              onChange={(e) => setAssetSymbol(e.target.value)}
              placeholder="BOING"
              className="w-full p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
            />
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Asset fields are passed only when a description hash is also provided, because the RPC accepts these as later optional metadata parameters.
        </p>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-network-cyan text-boing-black font-semibold hover:bg-network-cyan-light disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Checking…" : "Check"}
        </button>
      </div>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`glass-card p-6 ${
            result.result === "allow"
              ? "border-green-500/40 bg-green-950/20"
              : result.result === "reject"
                ? "border-red-500/40 bg-red-950/20"
                : "border-amber-500/40 bg-amber-950/20"
          }`}
        >
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-2">
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
        </div>
      )}

      <section className="text-sm text-[var(--text-muted)] space-y-2">
        <p>
          Valid purpose categories: dApp, token, NFT, meme, community, entertainment, tooling, other.
        </p>
        <p>
          Advanced metadata note: `asset_name` and `asset_symbol` are supported by the current node RPC and are sent from this UI only when a description hash is present.
        </p>
        <p>
          <a
            href={QA_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            Quality assurance rules and guidance
          </a>{" "}
          cover both the QA flow and the canonical malice definition.
        </p>
      </section>
    </div>
  );
}
