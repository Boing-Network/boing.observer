"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { SearchBar } from "@/components/search-bar";
import { NetworkStats } from "@/components/network-stats";
import { NetworkCharts } from "@/components/network-charts";
import { fetchChainHeight, fetchBlockByHeight } from "@/lib/rpc-methods";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import type { Block } from "@/lib/rpc-types";
import { shortenHash, hexForLink } from "@/lib/rpc-types";
import { NETWORK_FAUCET_URL } from "@/lib/constants";

export default function HomePage() {
  const { network } = useNetwork();
  const [height, setHeight] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchChainHeight(network)
      .then((h) => {
        if (cancelled) return [];
        setHeight(h);
        return Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            fetchBlockByHeight(network, Math.max(0, h - i))
          )
        );
      })
      .then((results) => {
        if (cancelled || !results) return;
        setBlocks(
          results
            .filter((b): b is Block => b != null && "hash" in b && "header" in b)
            .slice(0, 12)
        );
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyRpcErrorMessage(e, network, "general"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Boing Observer
        </h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          Explore blocks, transactions, and accounts on Boing Network.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Public onboarding for testnet BOING lives on{" "}
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            boing.network/network/faucet
          </a>
          . The explorer also includes direct RPC helper pages for advanced users.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:text-network-cyan-light font-medium transition-colors"
          >
            Get testnet BOING →
          </a>
          <Link
            href="/faucet"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
          >
            Use RPC faucet helper →
          </Link>
          <Link
            href="/tools/qa-check"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
          >
            Open QA Check →
          </Link>
        </div>
        <div className="mt-6">
          <SearchBar />
        </div>
      </section>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      <NetworkStats />

      <NetworkCharts />

      <section>
        <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Chain tip
        </h2>
        {loading ? (
          <div className="mt-2 h-8 w-48 bg-white/5 rounded animate-pulse" aria-busy="true" />
        ) : height !== null ? (
          <p className="mt-2 font-mono text-lg text-network-cyan">
            Current height: <span className="font-semibold">{height.toLocaleString()}</span>
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Latest blocks
        </h2>
        {loading ? (
          <div className="mt-4 space-y-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        ) : blocks.length === 0 && !error ? (
          <div className="mt-4 glass-card p-8 text-center text-[var(--text-muted)]">
            <p>No blocks yet. The chain may be starting or RPC returned no data.</p>
            <p className="mt-2 text-sm">Try switching networks or refreshing.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-sm text-[var(--text-muted)]">
                  <th className="pb-3 pr-4 font-medium">Height</th>
                  <th className="pb-3 pr-4 font-medium">Hash</th>
                  <th className="pb-3 pr-4 font-medium">Proposer</th>
                  <th className="pb-3 pr-4 font-medium">Txns</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => {
                  const hashStr = hexForLink(b.hash);
                  const proposerStr = hexForLink(b.header.proposer);
                  return (
                  <tr
                    key={hashStr || b.header.height}
                    className="border-b border-[var(--border-color)]/60 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/block/${b.header.height}?network=${network}`}
                        className="font-mono text-network-cyan hover:text-network-cyan-light underline underline-offset-2"
                      >
                        {b.header.height}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/block/hash/${hashStr}?network=${network}`}
                        className="hash text-[var(--text-secondary)] hover:text-network-primary-light"
                      >
                        {shortenHash(hashStr)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/account/${proposerStr}?network=${network}`}
                        className="hash text-network-cyan hover:underline"
                      >
                        {shortenHash(proposerStr)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-sm">
                      {b.transactions?.length ?? 0}
                    </td>
                    <td className="py-3 font-mono text-sm text-[var(--text-muted)]">
                      {b.header.timestamp
                        ? new Date(Number(b.header.timestamp) * 1000).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
