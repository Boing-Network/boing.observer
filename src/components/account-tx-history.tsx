"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ACCOUNT_TX_HISTORY_WINDOWS,
  DEFAULT_ACCOUNT_TX_HISTORY_WINDOW,
  accountTxRoleLabel,
  type AccountTxHistoryItem,
} from "@/lib/account-tx-history";
import { explorerAccountHref, explorerBlockHeightHref, explorerTxHref } from "@/lib/explorer-href";
import type { NetworkId } from "@/lib/rpc-types";
import { shortenHash } from "@/lib/rpc-types";

type HistoryOk = {
  address: string;
  headHeight: number;
  scannedFromHeight: number;
  scannedToHeight: number;
  blocksFetched: number;
  items: AccountTxHistoryItem[];
  note?: string;
};

function txHref(row: AccountTxHistoryItem, network: NetworkId): string {
  if (row.txId) return explorerTxHref(row.txId, network);
  return explorerBlockHeightHref(row.blockHeight, network, row.txIndex);
}

function formatTs(ts: number | null): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export function AccountTxHistory({ address64, network }: { address64: string; network: NetworkId }) {
  const [windowBlocks, setWindowBlocks] = useState<number>(DEFAULT_ACCOUNT_TX_HISTORY_WINDOW);
  const [data, setData] = useState<HistoryOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = new URL("/api/account/history", window.location.origin);
      u.searchParams.set("network", network);
      u.searchParams.set("id", `0x${address64}`);
      u.searchParams.set("window", String(windowBlocks));
      const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
      const json = (await res.json()) as HistoryOk & { error?: string };
      if (!res.ok) {
        setData(null);
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [address64, network, windowBlocks]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4" aria-labelledby="account-tx-history-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="account-tx-history-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Transaction history
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--text-muted)]">
            Transfers, deploys, calls, and stake txs in recent committed blocks where this address is the signer,
            recipient, called contract, or newly created account. This is a bounded RPC scan, not a full indexer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_TX_HISTORY_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowBlocks(w)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                windowBlocks === w
                  ? "border-network-cyan bg-network-cyan/15 text-network-cyan"
                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
              }`}
            >
              Last {w} blocks
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="glass-card h-32 animate-pulse rounded-lg bg-white/5" aria-busy="true">
          <p className="p-4 text-sm text-[var(--text-muted)]">Scanning recent committed blocks…</p>
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      )}
      {data && !loading && !error && (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {data.items.length} tx{data.items.length === 1 ? "" : "s"} in blocks #{data.scannedFromHeight}–
            {data.scannedToHeight} (tip #{data.headHeight}
            {data.blocksFetched !== data.scannedToHeight - data.scannedFromHeight + 1
              ? ` · ${data.blocksFetched} blocks returned`
              : ""}
            ).
          </p>
          {data.items.length === 0 ? (
            <p className="glass-card p-6 text-sm text-[var(--text-muted)]">
              No matching transactions in this window. Widen the scan, or wait until a transfer to this address is
              included in a block.
            </p>
          ) : (
            <>
              <div className="data-card-list md:hidden">
                {data.items.map((row) => (
                  <div key={`${row.blockHeight}-${row.txIndex}-${row.txId ?? ""}`} className="data-card space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]"
                        >
                          {accountTxRoleLabel(role)}
                        </span>
                      ))}
                      <span className="font-mono text-xs text-[var(--text-muted)]">{row.kind}</span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)]">{row.summary}</p>
                    <div className="data-card__row">
                      <span className="data-card__label">When</span>
                      <span className="data-card__value">{formatTs(row.timestamp)}</span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Block</span>
                      <span className="data-card__value">
                        <Link
                          href={explorerBlockHeightHref(row.blockHeight, network, row.txIndex)}
                          className="font-mono text-network-cyan hover:underline"
                        >
                          #{row.blockHeight}
                        </Link>
                      </span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Tx</span>
                      <span className="data-card__value">
                        <Link href={txHref(row, network)} className="hash font-mono text-xs text-network-cyan hover:underline">
                          {row.txId ? shortenHash(row.txId, 12, 10) : `slot ${row.txIndex}`}
                        </Link>
                      </span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Signer</span>
                      <span className="data-card__value">
                        {row.sender ? (
                          <Link
                            href={explorerAccountHref(row.sender, network)}
                            className="address-link text-xs"
                          >
                            {shortenHash(row.sender)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="glass-card table-scroll-wrap hidden md:block">
                <p className="table-scroll-hint px-3 pt-3">Swipe horizontally to see all columns</p>
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-muted)]">
                      <th className="p-3 font-medium">When</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Summary</th>
                      <th className="p-3 font-medium">Signer</th>
                      <th className="p-3 font-medium">Block</th>
                      <th className="p-3 font-medium">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={`${row.blockHeight}-${row.txIndex}-${row.txId ?? ""}`} className="border-b border-[var(--border-color)]/60">
                        <td className="p-3 align-top text-xs text-[var(--text-secondary)]">{formatTs(row.timestamp)}</td>
                        <td className="p-3 align-top">
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map((role) => (
                              <span
                                key={role}
                                className="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]"
                              >
                                {accountTxRoleLabel(role)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 align-top font-mono text-xs">{row.kind}</td>
                        <td className="p-3 align-top text-[var(--text-primary)]">{row.summary}</td>
                        <td className="p-3 align-top">
                          {row.sender ? (
                            <Link href={explorerAccountHref(row.sender, network)} className="address-link text-xs">
                              {shortenHash(row.sender)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 align-top font-mono text-xs">
                          <Link
                            href={explorerBlockHeightHref(row.blockHeight, network, row.txIndex)}
                            className="text-network-cyan hover:underline"
                          >
                            #{row.blockHeight}
                          </Link>
                        </td>
                        <td className="p-3 align-top">
                          <Link href={txHref(row, network)} className="hash font-mono text-xs text-network-cyan hover:underline">
                            {row.txId ? shortenHash(row.txId, 12, 10) : `slot ${row.txIndex}`}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {data.note ? <p className="text-xs text-[var(--text-muted)] leading-relaxed">{data.note}</p> : null}
        </>
      )}
    </section>
  );
}
