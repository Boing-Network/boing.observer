"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { explorerAssetHref } from "@/lib/explorer-href";
import {
  FINANCE_LINKED_PROJECT_URL,
  FRESHMINT_URL,
  LINKED_NFT_TOKEN_DOC_URL,
  WALLET_URL,
} from "@/lib/constants";
import type { LinkedCompanionPeer } from "@/lib/linked-nft-token-registry";
import type { NetworkId } from "@/lib/rpc-types";
import { shortenHash, toPrefixedHex64 } from "@/lib/rpc-types";

type CompanionsPayload = {
  supported: true;
  registryId: string | null;
  registrySource: string | null;
  slotCount: number;
  companions: LinkedCompanionPeer[];
  note?: string;
  error?: string;
};

function peerRoleLabel(role: LinkedCompanionPeer["peerRole"]): string {
  return role === "fungible" ? "Related coin" : "Linked collection";
}

/**
 * Read-only linked NFT ↔ fungible companions for an asset / account / NFT collection.
 * Does not offer claim, register, or unlink — those stay on FreshMint / finance / SDK.
 */
export function LinkedCompanionsSection({
  network,
  address64,
}: {
  network: NetworkId;
  /** Unprefixed or prefixed 32-byte AccountId (collection or fungible). */
  address64: string;
  /** @deprecated Unused; kept for call-site compatibility. */
  contextLabel?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<CompanionsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const id = encodeURIComponent(toPrefixedHex64(address64));
    fetch(`/api/asset/companions?network=${encodeURIComponent(network)}&id=${id}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const j = (await res.json()) as CompanionsPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setPayload(null);
          setError(j.error || `HTTP ${res.status}`);
          return;
        }
        if (j.supported === true) {
          setPayload(j);
          setError(null);
        } else {
          setPayload(null);
          setError("Unexpected companions response");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPayload(null);
          setError("Couldn't load linked items right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, address64]);

  return (
    <section
      className="glass-card space-y-4 p-4 sm:p-6"
      aria-labelledby="linked-companions-heading"
      data-testid="linked-companions"
    >
      <div className="space-y-1">
        <h2
          id="linked-companions-heading"
          className="font-display text-lg font-semibold text-[var(--text-primary)]"
        >
          Linked tokens &amp; collections
        </h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Officially linked NFT collections and coins for this address. View only here — create or
          change links on{" "}
          <a
            href={FINANCE_LINKED_PROJECT_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            boing.finance
          </a>
          {" "}
          or{" "}
          <a
            href={FRESHMINT_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            FreshMint
          </a>
          . Wallet:{" "}
          <a
            href={WALLET_URL}
            className="text-network-cyan hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            boing.express
          </a>
          .
        </p>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded bg-white/5" aria-busy="true" />
      ) : error ? (
        <p className="text-sm text-amber-300" role="status">
          Couldn&apos;t load linked items right now.
        </p>
      ) : payload?.companions.length ? (
        <ul className="space-y-3" data-testid="linked-companions-list">
          {payload.companions.map((c) => (
            <li
              key={`${c.index}-${c.peerId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-color)] pt-3 first:border-t-0 first:pt-0"
            >
              <span className="rounded-full border border-[var(--border-color)] bg-white/5 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                {peerRoleLabel(c.peerRole)}
              </span>
              <Link
                href={explorerAssetHref(c.peerId, network)}
                className="font-mono text-sm text-network-cyan hover:underline break-all"
              >
                {shortenHash(c.peerId, 10, 8)}
              </Link>
              <CopyButton value={toPrefixedHex64(c.peerId)} label="Copy address" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]" role="status" data-testid="linked-companions-empty">
          Nothing linked to this yet.
        </p>
      )}

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        <a
          href={LINKED_NFT_TOKEN_DOC_URL}
          className="text-network-cyan hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          How linking works
        </a>
      </p>
    </section>
  );
}
