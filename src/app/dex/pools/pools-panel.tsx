"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { explorerAssetHref } from "@/lib/explorer-href";
import { shortenHash, normalizeHex64 } from "@/lib/rpc-types";
import { NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL, QA_RPC_TWO_SURFACES_DOC_URL } from "@/lib/constants";
import { DexRpcPoolsSection } from "./dex-rpc-pools-section";

type LogsMode = "none" | "recent" | "full";

type SnapshotResponse = {
  chainId: number | null;
  headHeight: number;
  pairsCount: string | null;
  logsMode: string;
  defaults: {
    nativeCpPoolAccountHex: string | null;
    nativeDexFactoryAccountHex: string | null;
    poolSource: string;
    factorySource: string;
  };
  registerLogs: { tokenAHex: string; tokenBHex: string; poolHex: string }[] | null;
};

function assetPath(hexWith0x: string, network: string): string {
  const h = normalizeHex64(hexWith0x.replace(/^0x/i, ""));
  return h ? explorerAssetHref(h, network) : "#";
}

export function PoolsPanel() {
  const { network } = useNetwork();
  const [logsMode, setLogsMode] = useState<LogsMode>("none");
  const [data, setData] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dex/snapshot?network=${network}&logs=${logsMode}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const json = (await res.json()) as { error?: string } & Partial<SnapshotResponse>;
      if (!res.ok) {
        setData(null);
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setData(json as SnapshotResponse);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [network, logsMode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="glass-card space-y-4 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Log scan mode</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Default is metadata + factory storage only (no <code className="rounded bg-white/10 px-1 text-xs">boing_getLogs</code>
          ). &quot;Recent&quot; scans up to 128 blocks ending at chain tip. &quot;Full&quot; walks the whole chain in bounded
          chunks — slower; use sparingly on public RPC (
          <a
            href={QA_RPC_TWO_SURFACES_DOC_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            alignment §2.1 (public vs local RPC)
          </a>
          ). For a separate cursor-paginated directory backed by indexer D1 (not a subgraph), see{" "}
          <a
            href={NATIVE_DEX_DIRECTORY_R2_HANDOFF_DOC_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["none", "Summary only"],
              ["recent", "Recent logs (128 blocks)"],
              ["full", "Full directory logs"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLogsMode(value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                logsMode === value
                  ? "border-network-cyan bg-network-cyan/15 text-network-cyan"
                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">Network: {network} (matches header selector)</p>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-6 w-48 rounded bg-white/5" />
          <div className="h-32 rounded bg-white/5" />
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && data && (
        <div className="space-y-6">
          <section className="glass-card space-y-3 p-4 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Network hints</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[var(--text-muted)]">Chain ID</dt>
                <dd className="font-mono">{data.chainId ?? "—"}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[var(--text-muted)]">Head height</dt>
                <dd className="font-mono">{data.headHeight}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-[var(--text-muted)]">Pairs registered (factory storage)</dt>
                <dd className="font-mono">{data.pairsCount ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="glass-card space-y-3 p-4 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Canonical contracts</h2>
            <ul className="space-y-3 text-sm">
              <li>
                <span className="text-[var(--text-muted)]">Native CP pool</span>
                {data.defaults.nativeCpPoolAccountHex ? (
                  <Link
                    href={assetPath(data.defaults.nativeCpPoolAccountHex, network)}
                    className="mt-1 block font-mono text-network-cyan hover:underline break-all"
                  >
                    {shortenHash(data.defaults.nativeCpPoolAccountHex, 12, 10)}
                  </Link>
                ) : (
                  <p className="mt-1 text-[var(--text-muted)]">Not published on this RPC</p>
                )}
                <p className="text-xs text-[var(--text-muted)] mt-1">Source: {data.defaults.poolSource}</p>
              </li>
              <li>
                <span className="text-[var(--text-muted)]">DEX factory (pair directory)</span>
                {data.defaults.nativeDexFactoryAccountHex ? (
                  <Link
                    href={assetPath(data.defaults.nativeDexFactoryAccountHex, network)}
                    className="mt-1 block font-mono text-network-cyan hover:underline break-all"
                  >
                    {shortenHash(data.defaults.nativeDexFactoryAccountHex, 12, 10)}
                  </Link>
                ) : (
                  <p className="mt-1 text-[var(--text-muted)]">Not published on this RPC</p>
                )}
                <p className="text-xs text-[var(--text-muted)] mt-1">Source: {data.defaults.factorySource}</p>
              </li>
            </ul>
          </section>

          {data.registerLogs && data.registerLogs.length > 0 && (
            <section className="glass-card space-y-3 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Register logs ({data.registerLogs.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                      <th className="pb-2 pr-3 font-medium">Pool</th>
                      <th className="pb-2 pr-3 font-medium">Token A</th>
                      <th className="pb-2 font-medium">Token B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.registerLogs.map((row, i) => (
                      <tr key={`${row.poolHex}-${i}`} className="border-b border-[var(--border-color)]/60">
                        <td className="py-2 pr-3 font-mono text-xs">
                          <Link href={assetPath(row.poolHex, network)} className="text-network-cyan hover:underline">
                            {shortenHash(row.poolHex, 10, 8)}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          <Link href={assetPath(row.tokenAHex, network)} className="text-network-cyan hover:underline">
                            {shortenHash(row.tokenAHex, 10, 8)}
                          </Link>
                        </td>
                        <td className="py-2 font-mono text-xs">
                          <Link href={assetPath(row.tokenBHex, network)} className="text-network-cyan hover:underline">
                            {shortenHash(row.tokenBHex, 10, 8)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {data.registerLogs && data.registerLogs.length === 0 && data.logsMode !== "none" && (
            <p className="text-sm text-[var(--text-muted)]">No register_pair logs in the selected block range.</p>
          )}
        </div>
      )}

      <DexRpcPoolsSection />
    </div>
  );
}
