"use client";

import { useState } from "react";
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

  async function handleRequest() {
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
    <div className="space-y-8 max-w-2xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">Faucet</li>
        </ol>
      </nav>

      <header>
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Testnet Faucet Helper
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Send a direct testnet faucet RPC request for gas and staking. 1,000 per request; rate limit 1 per 60 seconds per account. Uses <code className="px-1.5 py-0.5 rounded bg-white/10 text-sm">boing_faucetRequest</code>.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          This page is an explorer-side RPC helper. For the canonical public faucet page and broader testnet onboarding flow, see{" "}
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            boing.network/faucet
          </a>
          {" "}or the{" "}
          <a
            href={NETWORK_TESTNET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            testnet hub
          </a>
          .
        </p>
      </header>

      {network === "mainnet" && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200">
          Switch to <strong>Testnet</strong> to use the faucet.
        </div>
      )}

      <div className="glass-card p-6 space-y-4">
        <div>
          <label htmlFor="account-id" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            Your account ID (32-byte hex)
          </label>
          <input
            id="account-id"
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="0x..."
            maxLength={66}
            className="w-full font-mono text-sm p-3 rounded-lg bg-boing-navy-mid border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-network-cyan/50"
          />
        </div>
        <button
          onClick={handleRequest}
          disabled={loading || network === "mainnet"}
          className="px-4 py-2 rounded-lg bg-network-cyan text-boing-black font-semibold hover:bg-network-cyan-light disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Requesting…" : "Request 1,000 testnet BOING"}
        </button>
      </div>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      {result && !error && (
        <div
          className={`glass-card p-6 ${
            result.ok ? "border-green-500/40 bg-green-950/20" : "border-amber-500/40 bg-amber-950/20"
          }`}
        >
          {result.ok ? (
            <p className="text-green-200">
              Success! {result.amount ?? "1,000"} testnet BOING sent. {result.message ?? ""}
            </p>
          ) : (
            <p className="text-amber-200">{result.message ?? "Request completed; check your wallet."}</p>
          )}
        </div>
      )}

      <section className="text-sm text-[var(--text-muted)]">
        <p>
          Your account ID is the 32-byte hex of your public key (e.g. from your wallet). Rate limit: 1 request per 60 seconds per account.
        </p>
        <p className="mt-2">
          If you want the standard website flow instead of a raw RPC helper, use{" "}
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            boing.network/faucet
          </a>
          .
        </p>
      </section>
    </div>
  );
}
