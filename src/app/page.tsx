"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { explorerAssetHref } from "@/lib/explorer-href";
import { useNetwork } from "@/context/network-context";
import { HomeChainDataProvider, useHomeChainData } from "@/context/home-chain-data";
import { SearchBar } from "@/components/search-bar";
import { SiteLogo } from "@/components/site-logo";
import { NetworkStats } from "@/components/network-stats";
import { NetworkChainContext } from "@/components/network-chain-context";
import { shortenHash, hexForLink } from "@/lib/rpc-types";
import { NETWORK_FAUCET_URL } from "@/lib/constants";

const chartSkeleton = (
  <div className="glass-card flex h-48 items-center justify-center text-[var(--text-muted)]" aria-busy="true">
    Loading charts…
  </div>
);

const NetworkCharts = dynamic(
  () => import("@/components/network-charts").then((m) => m.NetworkCharts),
  { ssr: false, loading: () => chartSkeleton }
);

const NetworkEconomyInsights = dynamic(
  () => import("@/components/network-economy-insights").then((m) => m.NetworkEconomyInsights),
  { ssr: false, loading: () => chartSkeleton }
);

function LatestBlocksSection() {
  const { network } = useNetwork();
  const { sliceBlocks, loading, error } = useHomeChainData();
  const blocks = sliceBlocks(12);

  return (
    <section aria-labelledby="latest-blocks-heading">
      <h2
        id="latest-blocks-heading"
        className="font-display text-lg font-semibold text-[var(--text-primary)] sm:text-xl"
      >
        Latest blocks
      </h2>
      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ) : blocks.length === 0 && !error ? (
        <div className="mt-4 glass-card p-6 text-center text-[var(--text-muted)] sm:p-8">
          <p>No blocks loaded — try another network or refresh.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {blocks.map((b) => {
              const hashStr = hexForLink(b.hash);
              const proposerStr = hexForLink(b.header.proposer);
              const t = b.header.timestamp
                ? new Date(Number(b.header.timestamp) * 1000).toLocaleString()
                : "—";
              return (
                <Link
                  key={hashStr || b.header.height}
                  href={`/block/${b.header.height}?network=${network}`}
                  className="glass-card block space-y-2 p-4 transition-colors hover:border-[var(--border-hover)] active:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg font-semibold text-network-cyan">
                      #{b.header.height}
                    </span>
                    <span className="shrink-0 text-right font-mono text-xs text-[var(--text-muted)]">{t}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span>
                      Hash{" "}
                      <span className="hash text-[var(--text-primary)]">{shortenHash(hashStr)}</span>
                    </span>
                    <span>
                      Txns <span className="font-mono text-network-cyan">{b.transactions?.length ?? 0}</span>
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Proposer{" "}
                    {proposerStr ? (
                      <Link
                        href={explorerAssetHref(proposerStr, network)}
                        className="hash text-network-cyan hover:underline"
                      >
                        {shortenHash(proposerStr)}
                      </Link>
                    ) : (
                      <span className="hash text-[var(--text-secondary)]">—</span>
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="table-scroll-wrap mt-4 hidden md:block">
            <table className="w-full min-w-[600px] border-collapse">
              <caption className="sr-only">Latest blocks, newest first</caption>
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
                          href={explorerAssetHref(proposerStr, network)}
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
        </>
      )}
    </section>
  );
}

function HomePageBody() {
  const { error } = useHomeChainData();

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-intro-heading">
        <SiteLogo variant="hero" headingId="home-intro-heading" />
        <p className="mt-1 max-w-2xl text-[var(--text-secondary)]">
          Blocks, accounts, and transactions on Boing.{" "}
          <Link href="/tools" className="text-network-cyan hover:underline">
            Tools
          </Link>
          {" · "}
          <a
            href={NETWORK_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-network-cyan hover:underline"
          >
            Testnet faucet
          </a>
          .
        </p>
        <div className="mt-6">
          <SearchBar />
        </div>
      </section>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      <section className="space-y-6" aria-labelledby="network-overview-heading">
        <div>
          <h2
            id="network-overview-heading"
            className="font-display text-xl font-semibold text-[var(--text-primary)]"
          >
            Network activity
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Live chain metrics, charts, pie breakdowns of recent activity, and context for supply data the RPC does not
            expose globally.
          </p>
        </div>
        <NetworkStats />
        <NetworkChainContext />
        <NetworkCharts />
        <NetworkEconomyInsights />
      </section>

      <LatestBlocksSection />
    </div>
  );
}

export default function HomePage() {
  return (
    <HomeChainDataProvider>
      <HomePageBody />
    </HomeChainDataProvider>
  );
}
