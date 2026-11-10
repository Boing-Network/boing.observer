"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { explorerItemHref } from "@/lib/explorer-href";
import type { NetworkId } from "@/lib/rpc-types";
import { shortenHash } from "@/lib/rpc-types";

type Row = { contract: string; itemId: string; balance: string | null; lastBlockHeight: number };

/** Game items (reference multi-token) the account holds: item type + quantity, from the request-driven index. */
export function AccountItemsPanel({ address64, network }: { address64: string; network: NetworkId }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const u = new URL("/api/items", window.location.origin);
    u.searchParams.set("network", network);
    u.searchParams.set("owner", `0x${address64}`);
    fetch(u.toString(), { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json()) as { items?: Row[]; error?: string };
        if (!live) return;
        if (!r.ok) setError(j.error ?? `HTTP ${r.status}`);
        setRows(j.items ?? []);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Request failed");
        setRows([]);
      });
    return () => {
      live = false;
    };
  }, [address64, network]);

  // Stay quiet for accounts without items (most of them).
  if (rows == null || (rows.length === 0 && !error)) return null;

  return (
    <section className="space-y-3" aria-labelledby="account-items-heading">
      <h2 id="account-items-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Game items held
      </h2>
      {error ? <p className="text-xs text-[var(--text-muted)]">{error}</p> : null}
      {rows.length > 0 ? (
        <ul className="glass-card divide-y divide-white/5" data-testid="account-items">
          {rows.map((r) => (
            <li key={`${r.contract}:${r.itemId}`} className="flex items-center justify-between px-4 py-2 text-sm">
              <Link href={explorerItemHref(r.contract, r.itemId, network)} className="text-network-cyan hover:underline">
                Item #{r.itemId}{" "}
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  in {shortenHash(r.contract.replace(/^0x/i, ""))}
                </span>
              </Link>
              <span className="font-mono">× {r.balance ?? "?"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
