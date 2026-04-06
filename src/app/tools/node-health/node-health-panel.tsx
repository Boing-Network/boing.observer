"use client";

import { useCallback, useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchChainHeight, fetchSyncState, tryFetchBoingHealth } from "@/lib/rpc-methods";
import type { BoingHealth, BoingSyncState } from "@/lib/rpc-types";
import { QA_RPC_TWO_SURFACES_DOC_URL, RPC_SPEC_URL } from "@/lib/constants";

type LoadState = {
  chainHeight: number | null;
  sync: BoingSyncState | null;
  health: BoingHealth | null;
  warnings: string[];
};

export function NodeHealthPanel() {
  const { network } = useNetwork();
  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    const msg = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));
    try {
      const [hRes, sRes, healthRes] = await Promise.allSettled([
        fetchChainHeight(network),
        fetchSyncState(network),
        tryFetchBoingHealth(network),
      ]);
      const warnings: string[] = [];
      if (hRes.status === "rejected") warnings.push(`boing_chainHeight: ${msg(hRes.reason)}`);
      if (sRes.status === "rejected") warnings.push(`boing_getSyncState: ${msg(sRes.reason)}`);
      setData({
        chainHeight: hRes.status === "fulfilled" ? hRes.value : null,
        sync: sRes.status === "fulfilled" ? sRes.value : null,
        health: healthRes.status === "fulfilled" ? healthRes.value : null,
        warnings,
      });
    } catch (e) {
      setData({
        chainHeight: null,
        sync: null,
        health: null,
        warnings: [msg(e)],
      });
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    void load();
  }, [load]);

  const headMismatch =
    data != null &&
    data.chainHeight != null &&
    data.sync != null &&
    data.chainHeight !== data.sync.head_height;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-network-cyan hover:border-network-cyan disabled:opacity-50"
        >
          Refresh
        </button>
        <span className="text-xs text-[var(--text-muted)]">Network: {network}</span>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
        Compares <code className="rounded bg-white/10 px-1">boing_chainHeight</code>,{" "}
        <code className="rounded bg-white/10 px-1">boing_getSyncState</code>, and optional{" "}
        <code className="rounded bg-white/10 px-1">boing_health</code> on your selected RPC. If results differ from a
        local node, see{" "}
        <a href={QA_RPC_TWO_SURFACES_DOC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
          alignment §2.1
        </a>
        . Spec:{" "}
        <a href={RPC_SPEC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
          RPC-API-SPEC
        </a>
        .
      </p>

      {loading && (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-24 rounded bg-white/5" />
          <div className="h-40 rounded bg-white/5" />
        </div>
      )}

      {!loading && data && data.warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          {data.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {!loading && data && (data.sync || data.chainHeight != null) && (
        <section className="glass-card space-y-3 p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Chain tip</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-muted)]">boing_chainHeight</dt>
              <dd className="font-mono text-network-cyan">{data.chainHeight ?? "—"}</dd>
            </div>
            {data.sync && (
              <>
                <div>
                  <dt className="text-[var(--text-muted)]">getSyncState.head_height</dt>
                  <dd className="font-mono text-network-cyan">{data.sync.head_height}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">finalized_height</dt>
                  <dd className="font-mono">{data.sync.finalized_height}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--text-muted)]">latest_block_hash</dt>
                  <dd className="hash font-mono text-xs text-[var(--text-secondary)] break-all">
                    {data.sync.latest_block_hash}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {headMismatch && (
            <p className="text-xs text-amber-200" role="status">
              Chain height and sync head differ — transient or RPC inconsistency; refresh or verify the endpoint.
            </p>
          )}
        </section>
      )}

      {!loading && data && data.health && (
        <section className="glass-card space-y-3 p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">boing_health</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-muted)]">ok</dt>
              <dd className="font-mono">{String(data.health.ok ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">client_version</dt>
              <dd className="font-mono text-xs text-[var(--text-secondary)]">{data.health.client_version ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">chain_id</dt>
              <dd className="font-mono">{data.health.chain_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">chain_name</dt>
              <dd>{data.health.chain_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">head_height (health)</dt>
              <dd className="font-mono">{data.health.head_height ?? "—"}</dd>
            </div>
          </dl>
          {data.health.rpc_surface && (
            <div className="overflow-x-auto pt-2">
              <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">rpc_surface</h3>
              <table className="w-full min-w-[28rem] text-left text-xs">
                <tbody>
                  {Object.entries(data.health.rpc_surface).map(([k, v]) => (
                    <tr key={k} className="border-b border-[var(--border-color)]/50">
                      <td className="py-1.5 pr-3 font-mono text-[var(--text-muted)]">{k}</td>
                      <td className="py-1.5 font-mono text-[var(--text-secondary)]">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.health.rpc_metrics && (
            <div className="overflow-x-auto pt-2">
              <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">rpc_metrics (cumulative)</h3>
              <table className="w-full min-w-[28rem] text-left text-xs">
                <tbody>
                  {Object.entries(data.health.rpc_metrics).map(([k, v]) => (
                    <tr key={k} className="border-b border-[var(--border-color)]/50">
                      <td className="py-1.5 pr-3 font-mono text-[var(--text-muted)]">{k}</td>
                      <td className="py-1.5 font-mono text-[var(--text-secondary)]">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && data && !data.health && (data.sync || data.chainHeight != null) && (
        <p className="text-sm text-[var(--text-muted)]">
          <code className="rounded bg-white/10 px-1">boing_health</code> not available on this RPC (older node or
          filtered gateway). Sync state above is still valid.
        </p>
      )}

      {!loading && data && !data.sync && data.chainHeight == null && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200" role="alert">
          Could not load chain tip. Verify <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_TESTNET_RPC</code> and
          network selection.
        </p>
      )}
    </div>
  );
}
