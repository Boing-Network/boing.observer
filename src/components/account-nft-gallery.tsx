"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { explorerNftItemHref } from "@/lib/explorer-href";
import type { NetworkId } from "@/lib/rpc-types";
import { shortenHash } from "@/lib/rpc-types";
import { AssetMediaThumb } from "@/components/asset-media-thumb";
import { TechnicalDetails } from "@/components/technical-details";
import { NFT_OWNER_INDEX_HANDOFF_DOC_URL } from "@/lib/constants";

type OwnedNftItem = {
  collection: string;
  tokenId: string;
  owner: string;
  metadataHash: string | null;
  lastBlockHeight: number;
  lastTxId: string;
  lastEventKind: string;
};

type ByOwnerResponse = {
  owner: string;
  items: OwnedNftItem[];
  nextCursor: string | null;
  indexer?: { lastCommittedHeight: number; lastCommittedBlockHash: string; chainId: string };
};

type GalleryState =
  | { status: "loading" }
  | { status: "not_configured"; hint?: string }
  | { status: "error"; message: string }
  | { status: "ready"; indexer: ByOwnerResponse["indexer"] | null };

const PAGE_LIMIT = 24;

/**
 * NFT holdings from the durable `workers/nft-owner-indexer` D1 index (boing.network), proxied
 * same-origin via `GET /api/account/nfts`. Complements the bounded recent-block scan elsewhere in
 * the explorer: this list survives beyond the ~256-block RPC window, but only once the operator
 * sets `NFT_OWNER_INDEXER_URL` (see HANDOFF_NFT_OWNER_INDEX.md) — until then the API returns 503
 * and this section shows a collapsed setup hint instead of an error.
 */
export function AccountNftGallery({ address64, network }: { address64: string; network: NetworkId }) {
  const [state, setState] = useState<GalleryState>({ status: "loading" });
  const [items, setItems] = useState<OwnedNftItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      if (!append) setState({ status: "loading" });
      try {
        const u = new URL("/api/account/nfts", window.location.origin);
        u.searchParams.set("network", network);
        u.searchParams.set("id", `0x${address64}`);
        u.searchParams.set("limit", String(PAGE_LIMIT));
        if (nextCursor) u.searchParams.set("cursor", nextCursor);
        const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
        const json = (await res.json()) as ByOwnerResponse & { error?: string; hint?: string };
        if (res.status === 503) {
          setState({ status: "not_configured", hint: json.hint });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: json.error ?? `HTTP ${res.status}` });
          return;
        }
        setItems((prev) => (append ? [...prev, ...(json.items ?? [])] : json.items ?? []));
        setCursor(json.nextCursor ?? null);
        setState({ status: "ready", indexer: json.indexer ?? null });
      } catch (e) {
        setState({ status: "error", message: e instanceof Error ? e.message : "Request failed" });
      }
    },
    [address64, network],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void load(null, false);
  }, [load]);

  const heading = (
    <h2
      id="account-nft-gallery-heading"
      className="font-display text-lg font-semibold text-[var(--text-primary)]"
    >
      NFTs held
    </h2>
  );

  if (state.status === "loading" && items.length === 0) {
    return (
      <section className="space-y-4" aria-labelledby="account-nft-gallery-heading">
        {heading}
        <div className="glass-card h-32 animate-pulse rounded-lg bg-white/5" aria-busy="true" />
      </section>
    );
  }

  if (state.status === "not_configured") {
    return (
      <section className="space-y-3" aria-labelledby="account-nft-gallery-heading">
        {heading}
        <TechnicalDetails summary="NFT holdings beyond the recent-block scan are not enabled yet">
          <p>
            This explorer only has the bounded recent-block scan for NFTs until the operator sets{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-xs">NFT_OWNER_INDEXER_URL</code>{" "}
            to the durable <code className="font-mono">nft-owner-indexer</code> Worker (D1-backed, survives
            beyond the ~256-block RPC window). See{" "}
            <a
              href={NFT_OWNER_INDEX_HANDOFF_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-network-cyan hover:underline"
            >
              NFT owner index handoff
            </a>
            .
          </p>
        </TechnicalDetails>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="space-y-3" aria-labelledby="account-nft-gallery-heading">
        {heading}
        <p
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          {state.message}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="account-nft-gallery-heading">
      <div>
        {heading}
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--text-muted)]">
          Reference NFTs (mint_batch / transfer_nft) from the durable owner index — not bounded to the
          recent-block scan window used elsewhere on this page.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="glass-card p-6 text-sm text-[var(--text-muted)]">
          No reference NFTs indexed for this account yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const tokenWord = item.tokenId.replace(/^0x/i, "").toLowerCase();
            const label = `Token ${shortenHash(tokenWord, 8, 6)}`;
            const href = explorerNftItemHref(item.collection, item.tokenId, network);
            return (
              <li key={`${item.collection}:${item.tokenId}`}>
                <Link href={href} className="glass-card block p-3 transition-colors hover:border-network-cyan/50">
                  <AssetMediaThumb imageUrl={null} alt={label} size="md" kind="nft" />
                  <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">{label}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Collection{" "}
                    <span className="font-mono text-network-cyan">
                      {shortenHash(item.collection.replace(/^0x/i, ""))}
                    </span>
                  </p>
                  {item.metadataHash ? (
                    <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                      meta {shortenHash(item.metadataHash.replace(/^0x/i, ""), 6, 4)}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {cursor && (
        <button
          type="button"
          onClick={() => void load(cursor, true)}
          disabled={state.status === "loading"}
          className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
        >
          Load more
        </button>
      )}

      {state.status === "ready" && state.indexer ? (
        <p className="text-xs text-[var(--text-muted)]">
          Indexed through block #{state.indexer.lastCommittedHeight} ({state.indexer.chainId}).
        </p>
      ) : null}
    </section>
  );
}
