"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchRpcMethodCatalog } from "@/lib/rpc-methods";
import type { RpcMethodCatalogResult } from "@/lib/rpc-types";
import { QA_RPC_TWO_SURFACES_DOC_URL, RPC_SPEC_URL } from "@/lib/constants";

export function RpcCatalogPanel() {
  const { network } = useNetwork();
  const [data, setData] = useState<RpcMethodCatalogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchRpcMethodCatalog(network);
      setData(catalog);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setData(null);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    void load();
  }, [load]);

  const methods = useMemo(() => data?.methods ?? [], [data]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter((m) => m.name.toLowerCase().includes(q) || (m.summary ?? "").toLowerCase().includes(q));
  }, [methods, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block max-w-md flex-1 space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Filter methods</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="e.g. boing_getLogs, qa, faucet"
            className="w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-network-cyan hover:border-network-cyan disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Network: {network}. If you see <strong>Method not found</strong>, the configured RPC may be an older node or a
        filtered gateway — see{" "}
        <a href={QA_RPC_TWO_SURFACES_DOC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
          alignment §2.1
        </a>
        .
      </p>

      {loading && (
        <div className="animate-pulse space-y-2" aria-busy="true">
          <div className="h-6 w-64 rounded bg-white/5" />
          <div className="h-40 rounded bg-white/5" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          <p>{error}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Full method list in{" "}
            <a href={RPC_SPEC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
              RPC-API-SPEC.md
            </a>
            .
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.description && <p className="text-sm text-[var(--text-secondary)]">{data.description}</p>}
          <p className="text-sm text-[var(--text-muted)]">
            Showing {filtered.length} of {methods.length} methods.
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-white/[0.03] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.name} className="border-b border-[var(--border-color)]/50">
                    <td className="px-3 py-2 font-mono text-xs text-network-cyan">{m.name}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{m.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
