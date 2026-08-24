"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { NETWORK_FAUCET_URL, NETWORK_TESTNET_URL } from "@/lib/constants";
import { faucetRequest, type FaucetResult } from "@/lib/rpc-methods";
import { toPrefixedHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";

export default function FaucetPage() {
  const { network } = useNetwork();
  const [accountId, setAccountId] = useState("");
  const [result, setResult] = useState<FaucetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setResult(null);
    const hex = toPrefixedHex64(accountId);
    if (!accountId.trim()) {
      setError("Enter your account ID (32-byte hex).");
      return;
    }
    if (!hex) {
      setError("Account ID must be 32 bytes (64 hex chars + 0x).");
      return;
    }
    if (network === "mainnet") {
      setError("Faucet is testnet only.");
      return;
    }
    setLoading(true);
    try {
      const res = await faucetRequest(network, hex);
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
          <li className="text-[var(--text-primary)]">Faucet helper</li>
        </ol>
      </nav>

      <header>
        <h1 className="page-title font-display">
          Testnet faucet helper
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Calls <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">boing_faucetRequest</code> — 1,000
          BOING per request, max once per 60s per account. Prefer the{" "}
          <a href={NETWORK_FAUCET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            public faucet
          </a>{" "}
          or{" "}
          <a href={NETWORK_TESTNET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            testnet hub
          </a>{" "}
          for onboarding.
        </p>
      </header>

      {network === "mainnet" && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200">
          Switch to <strong>Testnet</strong> to use the faucet.
        </div>
      )}

      <form className="glass-card space-y-4 p-4 sm:p-6" onSubmit={(e) => void handleRequest(e)} noValidate>
        <div>
          <label htmlFor="account-id" className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Account ID (32-byte hex)
          </label>
          <input
            id="account-id"
            name="account-id"
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="0x..."
            maxLength={66}
            autoComplete="off"
            className="w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid p-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
          />
        </div>
        <button
          type="submit"
          disabled={loading || network === "mainnet"}
          className="rounded-lg bg-network-cyan px-4 py-2 font-semibold text-boing-black hover:bg-network-cyan-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Requesting…" : "Request 1,000 testnet BOING"}
        </button>
      </form>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      {result && !error && (
        <output
          className={`block glass-card p-6 ${
            result.ok ? "border-green-500/40 bg-green-950/20" : "border-amber-500/40 bg-amber-950/20"
          }`}
          aria-live="polite"
        >
          {result.ok ? (
            <p className="text-green-200">
              {result.amount ?? "1,000"} testnet BOING sent. {result.message ?? ""}
            </p>
          ) : (
            <p className="text-amber-200">{result.message ?? "Request completed; check your wallet."}</p>
          )}
        </output>
      )}
    </div>
  );
}
