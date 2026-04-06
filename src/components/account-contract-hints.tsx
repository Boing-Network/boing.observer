"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchNetworkInfo, tryFetchContractStorageWord } from "@/lib/rpc-methods";
import type { BoingNetworkInfo, NetworkId } from "@/lib/rpc-types";
import { normalizeHex64, shortenHash } from "@/lib/rpc-types";
import { CopyButton } from "@/components/copy-button";
import { HANDOFF_DEPENDENT_PROJECTS_URL, OBSERVER_HOSTED_SERVICE_URL, RPC_SPEC_URL } from "@/lib/constants";

function canonHex64(h: string | null | undefined): string {
  if (h == null || h === "") return "";
  return normalizeHex64(h.replace(/^0x/i, ""));
}

export function AccountContractHints({ network, address64 }: { network: NetworkId; address64: string }) {
  const [netInfo, setNetInfo] = useState<BoingNetworkInfo | null>(null);
  const [storageValue, setStorageValue] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setNetInfo(null);
    setStorageValue(undefined);
    void Promise.allSettled([
      fetchNetworkInfo(network),
      tryFetchContractStorageWord(network, `0x${address64}`),
    ]).then((results) => {
      if (cancelled) return;
      const ni = results[0];
      const sw = results[1];
      setNetInfo(ni.status === "fulfilled" ? ni.value : null);
      if (sw.status === "fulfilled") {
        setStorageValue(sw.value != null ? sw.value.value : null);
      } else {
        setStorageValue(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [network, address64]);

  const self = address64.toLowerCase();
  const poolHex = canonHex64(netInfo?.end_user?.canonical_native_cp_pool ?? undefined);
  const factoryHex = canonHex64(netInfo?.end_user?.canonical_native_dex_factory ?? undefined);
  const isCanonicalPool = poolHex !== "" && poolHex === self;
  const isCanonicalFactory = factoryHex !== "" && factoryHex === self;

  if (storageValue === undefined && !netInfo) {
    return (
      <div className="animate-pulse space-y-2" aria-busy="true">
        <div className="h-16 rounded bg-white/5" />
      </div>
    );
  }

  return (
    <section className="glass-card space-y-4 p-4 sm:p-6" aria-labelledby="account-contract-hints-heading">
      <h2 id="account-contract-hints-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Contract &amp; network hints
      </h2>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Uses <code className="rounded bg-white/10 px-1">boing_getNetworkInfo</code> and a single{" "}
        <code className="rounded bg-white/10 px-1">boing_getContractStorage</code> read at slot{" "}
        <code className="rounded bg-white/10 px-1">0…0</code> (see{" "}
        <a href={RPC_SPEC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
          RPC-API-SPEC
        </a>
        ). A zero word or failed read does not prove an account is an EOA.
      </p>

      {(isCanonicalPool || isCanonicalFactory) && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {isCanonicalPool && (
            <li className="rounded-full border border-network-cyan/50 bg-network-cyan/10 px-3 py-1 text-network-cyan">
              Canonical native CP pool (RPC <code className="text-xs">end_user</code>)
            </li>
          )}
          {isCanonicalFactory && (
            <li className="rounded-full border border-network-cyan/50 bg-network-cyan/10 px-3 py-1 text-network-cyan">
              Canonical native DEX factory (RPC <code className="text-xs">end_user</code>)
            </li>
          )}
        </ul>
      )}

      {storageValue !== undefined && (
        <div className="space-y-2 text-sm">
          <h3 className="font-medium text-[var(--text-primary)]">Storage word (slot 0)</h3>
          {storageValue === null ? (
            <p className="text-[var(--text-muted)]">
              Could not read storage at the zero key — method missing, node error, or account may not expose contract
              storage on this RPC.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <code className="hash break-all rounded bg-black/30 px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                {shortenHash(storageValue, 18, 16)}
              </code>
              <CopyButton value={storageValue} label="Copy word" />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Native DEX tools:{" "}
        <Link href="/dex/pools" className="text-network-cyan hover:underline">
          directory
        </Link>
        {" · "}
        <Link href="/dex/quote" className="text-network-cyan hover:underline">
          quotes
        </Link>
      </p>

      <div className="border-t border-[var(--border-color)] pt-4 text-xs leading-relaxed text-[var(--text-muted)]">
        <p className="font-medium text-[var(--text-secondary)]">Indexer &amp; bytecode scope</p>
        <p className="mt-1">
          This explorer stays <strong className="text-[var(--text-secondary)]">RPC-only</strong>: there is no dedicated
          JSON-RPC method here to dump full contract bytecode for every account. Historical search, reorg-safe indexing,
          and a durable read API are described in{" "}
          <a
            href={OBSERVER_HOSTED_SERVICE_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OBSERVER-HOSTED-SERVICE.md
          </a>{" "}
          (OBS-1) and ship as a <strong className="text-[var(--text-secondary)]">separate service</strong>, not inside
          this Next app. Cross-repo backlog:{" "}
          <a
            href={HANDOFF_DEPENDENT_PROJECTS_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            HANDOFF-DEPENDENT-PROJECTS
          </a>
          .
        </p>
      </div>
    </section>
  );
}
