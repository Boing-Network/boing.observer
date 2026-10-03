"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchNetworkInfo, tryFetchContractStorageWord } from "@/lib/rpc-methods";
import type { BoingNetworkInfo, NetworkId } from "@/lib/rpc-types";
import { normalizeHex64, shortenHash } from "@/lib/rpc-types";
import { CopyButton } from "@/components/copy-button";
import { TechnicalDetails } from "@/components/technical-details";
import { HANDOFF_DEPENDENT_PROJECTS_URL, OBSERVER_HOSTED_SERVICE_URL, RPC_SPEC_URL } from "@/lib/constants";

function canonHex64(h: string | null | undefined): string {
  if (h == null || h === "") return "";
  return normalizeHex64(h.replace(/^0x/i, ""));
}

export function AccountContractHints({
  network,
  address64,
  rpcInteractionHints,
}: {
  network: NetworkId;
  address64: string;
  rpcInteractionHints?: {
    inDexUniverse: boolean;
    poolCount?: number;
    tokenKind?: string;
    purposeCategory?: string | null;
  } | null;
}) {
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
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        Roles published by the network and a quick storage peek for this account.
      </p>

      {(isCanonicalPool || isCanonicalFactory) && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {isCanonicalPool && (
            <li className="rounded-full border border-network-cyan/50 bg-network-cyan/10 px-3 py-1 text-network-cyan">
              Canonical liquidity pool
            </li>
          )}
          {isCanonicalFactory && (
            <li className="rounded-full border border-network-cyan/50 bg-network-cyan/10 px-3 py-1 text-network-cyan">
              Canonical DEX factory
            </li>
          )}
        </ul>
      )}

      {storageValue !== undefined && (
        <div className="space-y-2 text-sm">
          <h3 className="font-medium text-[var(--text-primary)]">Primary storage word</h3>
          {storageValue === null ? (
            <p className="text-[var(--text-muted)]">No storage word available for this account on the selected network.</p>
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

      {rpcInteractionHints?.inDexUniverse && (
        <p className="text-sm text-[var(--text-secondary)]">
          Listed in the native DEX
          {typeof rpcInteractionHints.poolCount === "number" ? (
            <>
              {" "}
              ({rpcInteractionHints.poolCount} pool{rpcInteractionHints.poolCount === 1 ? "" : "s"})
            </>
          ) : null}
          . This explorer does not submit swaps.
        </p>
      )}

      {rpcInteractionHints?.tokenKind && rpcInteractionHints.tokenKind !== "other" && (
        <p className="text-sm text-[var(--text-secondary)]">
          Kind: <span className="text-[var(--text-primary)]">{rpcInteractionHints.tokenKind}</span>
          {rpcInteractionHints.purposeCategory ? (
            <>
              {" "}
              · <span className="break-words">{rpcInteractionHints.purposeCategory}</span>
            </>
          ) : null}
        </p>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        <Link href="/dex/pools" className="text-network-cyan hover:underline">
          DEX pools
        </Link>
        {" · "}
        <Link href="/dex/quote" className="text-network-cyan hover:underline">
          Quotes
        </Link>
        {" · "}
        <Link href="/about" className="text-network-cyan hover:underline">
          Docs
        </Link>
      </p>

      <TechnicalDetails summary="Technical details">
        <p>
          Network roles come from published chain metadata; storage is a single keyed read. Simulate calls and deeper
          contract APIs are in the{" "}
          <a href={RPC_SPEC_URL} className="text-network-cyan hover:underline" target="_blank" rel="noopener noreferrer">
            RPC API spec
          </a>
          . Durable bytecode and history indexing:{" "}
          <a
            href={OBSERVER_HOSTED_SERVICE_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            hosted observer service notes
          </a>
          ; backlog:{" "}
          <a
            href={HANDOFF_DEPENDENT_PROJECTS_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            dependent projects
          </a>
          .
        </p>
      </TechnicalDetails>
    </section>
  );
}
