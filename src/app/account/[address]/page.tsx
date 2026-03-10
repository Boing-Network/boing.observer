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
import { NETWORK_FAUCET_URL } from "@/lib/constants";

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
        <Link href="/" className="text-network-cyan hover:underline text-sm">← Home</Link>
        <p className="text-red-400">Invalid account address (must be 32-byte hex, 64 characters).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="text-network-cyan hover:underline text-sm">← Home</Link>

      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Account
      </h1>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="hash text-sm text-[var(--text-muted)] break-all font-mono" title={address}>
          0x{address}
        </p>
        <CopyButton value={toPrefixedHex64(address)} label="Copy address" />
      </div>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-32" />
          <div className="h-24 bg-white/5 rounded" />
        </div>
      )}
      {error && <p className="text-amber-300" role="alert">{error}</p>}

      {!loading && !error && account && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Balance &amp; state</h2>
          <dl className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Balance (BOING)</dt>
              <dd className="font-mono text-network-cyan font-medium">
                {formatBalance(account.balance)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Nonce</dt>
              <dd className="font-mono">{account.nonce}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Stake (BOING)</dt>
              <dd className="font-mono text-network-cyan">
                {formatBalance(account.stake)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Balances and stake are in smallest units (u128); displayed with 18 decimals for BOING.
          </p>
          {network === "testnet" && (
            <p className="text-sm mt-3">
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
      )}
    </div>
  );
}
