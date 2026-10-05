"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { AssetMediaThumb } from "@/components/asset-media-thumb";
import { CopyButton } from "@/components/copy-button";
import { ExplorerCrumbs } from "@/components/explorer-crumbs";
import {
  explorerAccountHref,
  explorerAssetHref,
  explorerNftItemHref,
} from "@/lib/explorer-href";
import { parseAssetDisplayMetadata } from "@/lib/extract-media-url";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import {
  isHex64,
  normalizeAddress,
  shortenHash,
  toPrefixedHex64,
} from "@/lib/rpc-types";
import type { NetworkId } from "@/lib/rpc-types";

type NftItemPayload = {
  supported: true;
  found: true;
  network: NetworkId;
  collection: string;
  tokenId: string;
  tokenIdU64: number | null;
  headHeight: number;
  rpcHost: string;
  owner: string | null;
  metadataHash: string | null;
  imageUrl: string | null;
  metadataUrl: string | null;
  metadataName: string | null;
};

function tokenLabel(tokenIdU64: number | null, tokenId: string): string {
  if (tokenIdU64 != null) return `Token #${tokenIdU64}`;
  return `Token ${shortenHash(tokenId, 10, 8)}`;
}

export function NftItemExplorerView() {
  const params = useParams();
  const { network } = useNetwork();
  const collectionParam = params?.address as string;
  const tokenIdParam = params?.tokenId as string;
  const collection = collectionParam ? normalizeAddress(collectionParam) : "";
  const tokenId = tokenIdParam ? normalizeAddress(tokenIdParam) : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<NftItemPayload | null>(null);

  useEffect(() => {
    if (!isHex64(collection) || !isHex64(tokenId)) {
      setLoading(false);
      setError("Invalid collection or token id (expect 32-byte hex each)");
      setItem(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({
      network,
      collection: toPrefixedHex64(collection),
      tokenId: toPrefixedHex64(tokenId),
    });
    fetch(`/api/asset/nft?${q.toString()}`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        const j = (await res.json()) as {
          error?: string;
          found?: boolean;
        } & Partial<NftItemPayload>;
        if (cancelled) return;
        if (!res.ok) {
          setItem(null);
          setError(j.error || `HTTP ${res.status}`);
          return;
        }
        if (j.supported === true && j.found === true) {
          setItem(j as NftItemPayload);
          setError(null);
        } else {
          setItem(null);
          setError(j.error || "NFT not found on this collection");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setItem(null);
          setError(getFriendlyRpcErrorMessage(e, network, "general"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, collection, tokenId]);

  const titleName =
    item?.metadataName != null
      ? parseAssetDisplayMetadata(item.metadataName).displayName ?? item.metadataName
      : null;
  const heading = item
    ? titleName
      ? `${titleName} · ${tokenLabel(item.tokenIdU64, item.tokenId)}`
      : tokenLabel(item.tokenIdU64, item.tokenId)
    : "NFT item";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <ExplorerCrumbs
        items={[
          { label: "Home", href: `/?network=${encodeURIComponent(network)}` },
          { label: "Tokens", href: `/tokens?network=${encodeURIComponent(network)}` },
          {
            label: "Collection",
            href: isHex64(collection) ? explorerAssetHref(collection, network) : undefined,
          },
          { label: "NFT" },
        ]}
      />

      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          NFT item profile
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
          {heading}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          On-chain reference NFT: owner and metadata hash slots on the collection contract. FreshMint
          and similar apps use opaque 32-byte token ids (not always sequential #1..N).
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading NFT…</p>
      ) : error ? (
        <div className="glass-card space-y-3 p-4 sm:p-6">
          <p className="text-sm text-red-300">{error}</p>
          {isHex64(collection) ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Open the{" "}
              <Link href={explorerAssetHref(collection, network)} className="text-network-cyan hover:underline">
                collection profile
              </Link>{" "}
              for minted samples discovered in the recent block window.
            </p>
          ) : null}
        </div>
      ) : item ? (
        <section className="glass-card space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <AssetMediaThumb
              imageUrl={item.imageUrl}
              alt={titleName ?? tokenLabel(item.tokenIdU64, item.tokenId)}
              size="lg"
              kind="nft"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Collection</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Link
                    href={explorerAssetHref(item.collection, network)}
                    className="font-mono text-sm text-network-cyan hover:underline break-all"
                  >
                    {shortenHash(item.collection)}
                  </Link>
                  <CopyButton value={toPrefixedHex64(item.collection)} label="Copy collection" />
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Token id</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-[var(--text-primary)] break-all">
                    {toPrefixedHex64(item.tokenId)}
                  </span>
                  <CopyButton value={toPrefixedHex64(item.tokenId)} label="Copy token id" />
                </div>
                {item.tokenIdU64 != null ? (
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Sequential form: #{item.tokenIdU64}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Opaque token id word (hash-style — not a small integer).
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Owner</p>
                {item.owner ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Link
                      href={explorerAccountHref(item.owner, network)}
                      className="font-mono text-sm text-network-cyan hover:underline break-all"
                    >
                      {shortenHash(item.owner)}
                    </Link>
                    <CopyButton value={toPrefixedHex64(item.owner)} label="Copy owner" />
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">No owner slot set</p>
                )}
              </div>
              {item.metadataHash ? (
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Metadata hash</p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-secondary)] break-all">
                    {item.metadataHash}
                  </p>
                  {item.metadataUrl ? (
                    <a
                      href={item.metadataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-network-cyan hover:underline"
                    >
                      Open resolved metadata URL
                    </a>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-[var(--text-muted)]">
                Tip {item.headHeight.toLocaleString()} · {item.rpcHost} · permalink{" "}
                <Link
                  href={explorerNftItemHref(item.collection, item.tokenId, network)}
                  className="text-network-cyan hover:underline"
                >
                  this page
                </Link>
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
