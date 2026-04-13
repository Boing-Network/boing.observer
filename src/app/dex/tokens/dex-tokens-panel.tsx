"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { explorerAssetHref } from "@/lib/explorer-href";
import { shortenHash, normalizeHex64 } from "@/lib/rpc-types";

type DexTokenRow = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  poolCount: number;
  firstSeenHeight: number | null;
  metadataSource?: "deploy" | "abbrev";
};

type TokenDiagnostics = {
  receiptScans: number;
  receiptScanCapped: boolean;
  deployBlocksScanned: number;
  deployMetadataMatched: number;
  deployMetadataUnmatchedWant: number;
};

type TokensOk = {
  supported: true;
  factory: string;
  tokens: DexTokenRow[];
  nextCursor: string | null;
  diagnostics?: TokenDiagnostics;
};

type TokensUnsupported = {
  supported: false;
  reason: string;
  message: string;
};

function assetPath(hexWith0x: string, network: string): string {
  const h = normalizeHex64(hexWith0x.replace(/^0x/i, ""));
  return h ? explorerAssetHref(h, network) : "#";
}

export function DexTokensPanel() {
  const { network } = useNetwork();
  const [rows, setRows] = useState<DexTokenRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [factory, setFactory] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [light, setLight] = useState(false);
  const [diagnosticsAllowed, setDiagnosticsAllowed] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<TokenDiagnostics | null>(null);

  const loadPage = useCallback(
    async (append: boolean, cursorVal: string | null) => {
      const qs = new URLSearchParams();
      qs.set("network", network);
      qs.set("limit", "50");
      if (cursorVal) qs.set("cursor", cursorVal);
      if (light) qs.set("light", "1");
      if (showDiagnostics && diagnosticsAllowed) qs.set("diagnostics", "1");

      const res = await fetch(`/api/dex/tokens-page?${qs.toString()}`, { headers: { Accept: "application/json" } });
      const json = (await res.json()) as
        | ({ error?: string } & Partial<TokensOk & TokensUnsupported>)
        | TokensUnsupported
        | TokensOk;

      if (!res.ok) {
        setError((json as { error?: string }).error || `HTTP ${res.status}`);
        return;
      }
      if ("supported" in json && json.supported === false) {
        setUnsupported(json.message);
        setRows([]);
        setFactory(null);
        setNextCursor(null);
        setDiagnostics(null);
        return;
      }
      const ok = json as TokensOk;
      setUnsupported(null);
      setError(null);
      setFactory(ok.factory);
      setNextCursor(ok.nextCursor);
      setDiagnostics(ok.diagnostics ?? null);
      setRows((prev) => (append ? [...prev, ...ok.tokens] : ok.tokens));
    },
    [network, light, showDiagnostics, diagnosticsAllowed]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cap = await fetch("/api/dex/capabilities");
        const cj = (await cap.json()) as { diagnosticsAllowed?: boolean };
        if (!cancelled) setDiagnosticsAllowed(Boolean(cj.diagnosticsAllowed));
      } catch {
        if (!cancelled) setDiagnosticsAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadPage(false, null).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      await loadPage(true, nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [loadPage, nextCursor]);

  return (
    <div className="space-y-6">
      <div className="glass-card space-y-4 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Query options</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={light}
              onChange={(e) => setLight(e.target.checked)}
              className="rounded border-[var(--border-color)]"
            />
            Light mode (skip receipt + deploy scans — <code className="text-xs">firstSeenHeight</code> null,{" "}
            <code className="text-xs">metadataSource</code> abbrev-only)
          </label>
          {diagnosticsAllowed ? (
            <label className="flex cursor-pointer items-center gap-2 text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={showDiagnostics}
                onChange={(e) => setShowDiagnostics(e.target.checked)}
                className="rounded border-[var(--border-color)]"
              />
              Include diagnostics (ops — receipt / deploy scan counters; explain caps to end users if you re-surface)
            </label>
          ) : null}
        </div>
        <p className="text-xs text-[var(--text-muted)]">Network: {network}</p>
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
      {unsupported && (
        <p className="rounded-lg border border-[var(--border-color)] bg-white/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
          {unsupported}
        </p>
      )}

      {!loading && !error && !unsupported && factory && (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            Factory:{" "}
            <Link href={assetPath(factory, network)} className="font-mono text-network-cyan hover:underline break-all">
              {shortenHash(factory, 14, 12)}
            </Link>
          </p>
          {diagnostics && (
            <div className="rounded-lg border border-network-cyan/30 bg-network-cyan/5 p-4 text-xs font-mono text-[var(--text-secondary)]">
              <p className="mb-2 font-sans text-sm font-medium text-network-cyan">Diagnostics</p>
              <dl className="grid gap-1 sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--text-muted)]">receiptScans</dt>
                  <dd>{diagnostics.receiptScans}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">receiptScanCapped</dt>
                  <dd>{String(diagnostics.receiptScanCapped)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">deployBlocksScanned</dt>
                  <dd>{diagnostics.deployBlocksScanned}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">deployMetadataMatched</dt>
                  <dd>{diagnostics.deployMetadataMatched}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">deployMetadataUnmatchedWant</dt>
                  <dd>{diagnostics.deployMetadataUnmatchedWant}</dd>
                </div>
              </dl>
            </div>
          )}
          <section className="glass-card overflow-x-auto p-4 sm:p-6">
            <h2 className="font-display mb-4 text-lg font-semibold text-[var(--text-primary)]">
              Tokens ({rows.length}
              {nextCursor ? "+" : ""})
            </h2>
            {rows.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No tokens in this page.</p>
            ) : (
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                    <th className="pb-2 pr-3 font-medium">Token</th>
                    <th className="pb-2 pr-3 font-medium">Symbol</th>
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Decimals</th>
                    <th className="pb-2 pr-3 font-medium">poolCount</th>
                    <th className="pb-2 pr-3 font-medium">firstSeenHeight</th>
                    <th className="pb-2 font-medium">metadataSource</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border-color)]/60">
                      <td className="py-2 pr-3 font-mono text-xs">
                        <Link href={assetPath(row.id, network)} className="text-network-cyan hover:underline break-all">
                          {shortenHash(row.id, 12, 10)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{row.symbol}</td>
                      <td className="py-2 pr-3 max-w-[12rem] truncate" title={row.name}>
                        {row.name}
                      </td>
                      <td className="py-2 pr-3 font-mono">{row.decimals}</td>
                      <td className="py-2 pr-3 font-mono">{row.poolCount}</td>
                      <td className="py-2 pr-3 font-mono">{row.firstSeenHeight ?? "—"}</td>
                      <td className="py-2 font-mono text-xs">{row.metadataSource ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {nextCursor ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="rounded-lg border border-network-cyan/50 px-4 py-2 text-sm font-medium text-network-cyan hover:bg-network-cyan/10 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
