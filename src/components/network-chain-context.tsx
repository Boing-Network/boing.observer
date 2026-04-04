"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { RPC_SPEC_URL, WEBSITE_URL } from "@/lib/constants";
import { fetchSyncState } from "@/lib/rpc-methods";
import type { BoingSyncState } from "@/lib/rpc-types";
import { hexForLink, shortenHash } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";

const REFRESH_INTERVAL_MS = 20_000;

export function NetworkChainContext() {
  const { network } = useNetwork();
  const [sync, setSync] = useState<BoingSyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await fetchSyncState(network);
      setSync(s);
    } catch (e) {
      setError(getFriendlyRpcErrorMessage(e, network, "stats"));
      setSync(null);
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const hashLink = sync?.latest_block_hash
    ? hexForLink(sync.latest_block_hash)
    : "";

  return (
    <div className="py-2" role="region" aria-labelledby="chain-context-heading">
      <h3
        id="chain-context-heading"
        className="mb-3 font-display text-base font-semibold text-[var(--text-primary)]"
      >
        Chain tip &amp; supply context
      </h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card space-y-3 p-4">
          <h4 className="text-sm font-medium text-[var(--text-muted)]">Committed tip</h4>
          {error ? (
            <p className="text-sm text-amber-200" role="alert">
              {error}
            </p>
          ) : loading ? (
            <p className="animate-pulse text-sm text-[var(--text-muted)]">Loading sync state…</p>
          ) : sync ? (
            <dl className="space-y-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Head height</dt>
                <dd className="font-mono text-network-cyan">{sync.head_height.toLocaleString()}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Finalized height</dt>
                <dd className="font-mono text-[var(--text-secondary)]">
                  {sync.finalized_height.toLocaleString()}
                </dd>
              </div>
              <div className="pt-1">
                <dt className="mb-1 text-[var(--text-muted)]">Latest block hash</dt>
                <dd>
                  {hashLink ? (
                    <Link
                      href={`/block/hash/${hashLink}?network=${network}`}
                      className="hash break-all text-network-cyan hover:text-network-cyan-light hover:underline"
                    >
                      {shortenHash(hashLink)}
                    </Link>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </dd>
              </div>
              <p className="pt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                From <code className="rounded bg-white/10 px-1 py-0.5 text-[0.7rem]">boing_getSyncState</code>. Head
                and finalized match today; they may diverge if the node exposes optimistic data later.
              </p>
            </dl>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No sync data.</p>
          )}
        </div>

        <div className="glass-card space-y-3 p-4">
          <h4 className="text-sm font-medium text-[var(--text-muted)]">Circulating &amp; total supply</h4>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            The public Boing JSON-RPC used by this explorer exposes blocks, accounts, and receipts — not
            network-level aggregates such as <strong className="text-[var(--text-primary)]">total minted supply</strong>
            , <strong className="text-[var(--text-primary)]">circulating supply</strong>, or{" "}
            <strong className="text-[var(--text-primary)]">total staked BOING</strong>. Those figures need an indexer,
            archive API, or a future RPC field so they stay consistent with protocol rules (fees, rewards, burns).
          </p>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            High-level token allocation and economics are described on the{" "}
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-network-cyan hover:underline"
            >
              Boing Network
            </a>{" "}
            site; method-level detail is in the{" "}
            <a
              href={RPC_SPEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-network-cyan hover:underline"
            >
              RPC API spec
            </a>
            .
          </p>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Per-account <strong className="text-[var(--text-secondary)]">balance</strong> and{" "}
            <strong className="text-[var(--text-secondary)]">stake</strong> are available via{" "}
            <code className="rounded bg-white/10 px-1 py-0.5">boing_getAccount</code> on the account page.
          </p>
        </div>
      </div>
    </div>
  );
}
