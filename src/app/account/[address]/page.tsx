"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { fetchAccount } from "@/lib/rpc-methods";
import type { Account } from "@/lib/rpc-types";
import { isHex64, normalizeAddress, formatBalance, toPrefixedHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { CopyButton } from "@/components/copy-button";
import { AccountBalanceMix } from "@/components/account-balance-mix";
import { AccountContractHints } from "@/components/account-contract-hints";
import { ADDRESS_FORMAT_ALIGNMENT_URL, NETWORK_FAUCET_URL } from "@/lib/constants";

export default function AccountPage() {
  const params = useParams();
  const { network } = useNetwork();
  const addressParam = params?.address as string;
  const address = addressParam ? normalizeAddress(addressParam) : "";
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHex64(address)) {
      setLoading(false);
      setError("Invalid account address");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const hexId = toPrefixedHex64(address);
    fetchAccount(network, hexId)
      .then((a) => {
        if (!cancelled) setAccount(a);
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyRpcErrorMessage(e, network, "account"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, address]);

  if (!isHex64(address)) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <div className="space-y-2 text-red-400" role="alert">
          <p>Invalid account address. Boing uses a 32-byte AccountId (64 hex digits, optional 0x) — not a 20-byte EVM address.</p>
          <p className="text-sm text-[var(--text-muted)]">
            <a href={ADDRESS_FORMAT_ALIGNMENT_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
              Address format (alignment doc §4)
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Account</h1>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          32-byte Boing AccountId (Ed25519 pubkey hash).{" "}
          <a href={ADDRESS_FORMAT_ALIGNMENT_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
            Format reference
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="hash break-all font-mono text-sm text-[var(--text-muted)]" title={address}>
            0x{address}
          </p>
          <CopyButton value={toPrefixedHex64(address)} label="Copy address" />
        </div>
      </header>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-32" />
          <div className="h-24 bg-white/5 rounded" />
        </div>
      )}
      {error && <p className="text-amber-300" role="alert">{error}</p>}

      {!loading && !error && account && (
        <section className="space-y-4" aria-labelledby="account-state-heading">
          <h2 id="account-state-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
            On-chain state
          </h2>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="glass-card space-y-4 p-4 sm:p-6">
              <h3 className="sr-only">Balances and nonce</h3>
              <dl className="grid gap-3 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--text-muted)]">Balance</dt>
                  <dd className="font-mono font-medium text-network-cyan">
                    {formatBalance(account.balance)} BOING
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--text-muted)]">Nonce</dt>
                  <dd className="font-mono">{account.nonce}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-[var(--text-muted)]">Stake</dt>
                  <dd className="font-mono text-network-primary-light">{formatBalance(account.stake)} BOING</dd>
                </div>
              </dl>
              {network === "testnet" && (
                <p className="text-sm">
                  <a
                    href={`${NETWORK_FAUCET_URL}?address=${encodeURIComponent(toPrefixedHex64(address))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-network-cyan hover:underline"
                  >
                    Get testnet BOING →
                  </a>
                </p>
              )}
            </div>
            <AccountBalanceMix balance={account.balance} stake={account.stake} />
          </div>
          <AccountContractHints network={network} address64={address} />
        </section>
      )}
    </div>
  );
}
