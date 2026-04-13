"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchAccount } from "@/lib/rpc-methods";
import { explorerAssetHref } from "@/lib/explorer-href";
import type { Account } from "@/lib/rpc-types";
import { isHex64, normalizeAddress, formatBalance, toPrefixedHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { CopyButton } from "@/components/copy-button";
import { AccountBalanceMix } from "@/components/account-balance-mix";
import { AccountContractHints } from "@/components/account-contract-hints";
import { ADDRESS_FORMAT_ALIGNMENT_URL, NETWORK_FAUCET_URL } from "@/lib/constants";

export function AddressExplorerView({ variant }: { variant: "account" | "asset" }) {
  const params = useParams();
  const { network } = useNetwork();
  const addressParam = params?.address as string;
  const address = addressParam ? normalizeAddress(addressParam) : "";
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dexLookupLoading, setDexLookupLoading] = useState(true);
  const [inDexUniverse, setInDexUniverse] = useState(false);

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

  useEffect(() => {
    if (!isHex64(address)) {
      setDexLookupLoading(false);
      setInDexUniverse(false);
      return;
    }
    let cancelled = false;
    setDexLookupLoading(true);
    const hexId = encodeURIComponent(toPrefixedHex64(address));
    fetch(`/api/dex/token?network=${encodeURIComponent(network)}&id=${hexId}`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        const j = (await res.json()) as { supported?: boolean; inDexUniverse?: boolean };
        if (!cancelled && res.ok && j.supported !== false) {
          setInDexUniverse(Boolean(j.inDexUniverse));
        } else if (!cancelled) {
          setInDexUniverse(false);
        }
      })
      .catch(() => {
        if (!cancelled) setInDexUniverse(false);
      })
      .finally(() => {
        if (!cancelled) setDexLookupLoading(false);
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
          <p>
            Invalid address. Boing uses a 32-byte AccountId (64 hex digits, optional{" "}
            <span className="font-mono">0x</span>) for accounts, contracts, and deployed assets — not a 20-byte EVM
            address.
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            <a
              href={ADDRESS_FORMAT_ALIGNMENT_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Address format (alignment doc §4)
            </a>
          </p>
        </div>
      </div>
    );
  }

  const title = variant === "asset" ? "Asset" : "Account";
  const alternateHref =
    variant === "asset"
      ? `/account/${address}?network=${encodeURIComponent(network)}`
      : explorerAssetHref(address, network);
  const alternateLabel = variant === "asset" ? "Open as account" : "Open as asset";

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">{title}</h1>
        {variant === "asset" ? (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Tokens, NFTs, and other contracts share the same 32-byte AccountId. Search or link here to inspect
            balances, nonce, and contract hints for this address.
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            32-byte Boing AccountId (Ed25519 pubkey hash).{" "}
            <a
              href={ADDRESS_FORMAT_ALIGNMENT_URL}
              className="text-network-cyan hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Format reference
            </a>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p className="hash break-all font-mono text-sm text-[var(--text-muted)]" title={address}>
            0x{address}
          </p>
          <CopyButton value={toPrefixedHex64(address)} label="Copy address" />
          {!dexLookupLoading && inDexUniverse && (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
              In DEX universe
              <Link href={`/dex/tokens?network=${encodeURIComponent(network)}`} className="text-network-cyan hover:underline">
                Token directory
              </Link>
              <span className="text-[var(--text-muted)]">·</span>
              <Link
                href={`/dex/pools?network=${encodeURIComponent(network)}#rpc-dex-pools`}
                className="text-network-cyan hover:underline"
              >
                RPC pools
              </Link>
              <span className="text-[var(--text-muted)]">·</span>
              <Link href={explorerAssetHref(address, network)} className="text-network-cyan hover:underline">
                Asset view
              </Link>
            </span>
          )}
        </div>
        <p className="text-xs">
          <Link href={alternateHref} className="text-network-cyan hover:underline">
            {alternateLabel}
          </Link>
        </p>
      </header>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-32" />
          <div className="h-24 bg-white/5 rounded" />
        </div>
      )}
      {error && (
        <p className="text-amber-300" role="alert">
          {error}
        </p>
      )}

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
