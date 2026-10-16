"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchNamesOwnedBy, nameHref, type BoingNameRecord } from "@/lib/boing-names";
import type { NetworkId } from "@/lib/rpc-methods";

/** Account page: `.boing` names this address owns (hidden when none / registry off). */
export function AccountNames({ address64, network }: { address64: string; network: string }) {
  const [names, setNames] = useState<BoingNameRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    setNames(null);
    fetchNamesOwnedBy(network as NetworkId, address64)
      .then((n) => {
        if (live) setNames(n);
      })
      .catch(() => {
        if (live) setNames([]);
      });
    return () => {
      live = false;
    };
  }, [address64, network]);
  if (!names || names.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="account-names-heading" data-testid="account-names">
      <h2 id="account-names-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Names
      </h2>
      <ul className="glass-card flex flex-wrap gap-2 p-4">
        {names.map((n) => (
          <li key={n.name}>
            <Link
              href={nameHref(n.name, network)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-white/5 px-3 py-1 text-sm text-network-cyan hover:bg-white/10"
            >
              {n.display}
              {n.status !== "active" ? <span className="text-xs text-amber-300">({n.status})</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}