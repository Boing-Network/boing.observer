"use client";

import Link from "next/link";
import { explorerAccountHref, explorerAssetHref, explorerBlockHeightHref, explorerNftItemHref, explorerTxHref } from "@/lib/explorer-href";
import { formatAssetDisplayLabel, parseAssetDisplayMetadata } from "@/lib/extract-media-url";
import { formatAssetKindLabel, formatPurposeLabel } from "@/lib/asset-kind-label";
import type { NetworkId } from "@/lib/rpc-types";
import { shortenHash } from "@/lib/rpc-types";
import type { TokenIndexJsonEntry } from "@/lib/token-index/types";
import { AssetMediaThumb } from "@/components/asset-media-thumb";

type DexTokenProfile = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  poolCount: number;
  firstSeenHeight: number | null;
  metadataSource?: "deploy" | "abbrev";
};

export type NftSamplePreview = {
  tokenIdU64: number | null;
  tokenIdWord: string;
  metadataHash: string;
  owner?: string | null;
  imageUrl: string | null;
  metadataUrl: string | null;
  metadataName: string | null;
};

export type ExplorerAssetProfilePayload = {
  supported: true;
  address: string;
  headHeight: number;
  rpcHost: string;
  factory: string | null;
  dexSupported: boolean;
  dexToken: DexTokenProfile | null;
  tokenIndex: TokenIndexJsonEntry | null;
  tokenIndexScan: { fromHeight: number; toHeight: number } | null;
  imageUrl: string | null;
  description?: string | null;
  nftSamples?: NftSamplePreview[];
  nftDiscoverNote?: string;
  /** Assets this account deployed (from the recent-block index scan). */
  deployedByAccount?: TokenIndexJsonEntry[];
  indexWarnings?: string[];
};

export function AssetMetadataSection({
  network,
  profile,
  scanUsed,
  onRequestScan,
}: {
  network: NetworkId;
  profile: ExplorerAssetProfilePayload;
  scanUsed: boolean;
  /** When set, shows a control to run the bounded deploy/receipt scan. */
  onRequestScan?: () => void;
}) {
  const { dexToken, tokenIndex, tokenIndexScan, indexWarnings, nftSamples, nftDiscoverNote, imageUrl, factory, deployedByAccount } =
    profile;
  const dexDisplay = dexToken ? parseAssetDisplayMetadata(dexToken.name, dexToken.symbol) : null;
  const indexDisplay = tokenIndex
    ? parseAssetDisplayMetadata(tokenIndex.assetName, tokenIndex.assetSymbol)
    : null;
  const heroImage = imageUrl || dexDisplay?.imageUrl || indexDisplay?.imageUrl || tokenIndex?.imageUrl || null;
  const hasBody = Boolean(dexToken || tokenIndex || nftSamples?.length || deployedByAccount?.length);

  return (
    <section className="glass-card space-y-4 p-4 sm:p-6" aria-labelledby="asset-metadata-heading">
      <h2 id="asset-metadata-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Metadata &amp; discovery
      </h2>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        DEX fields come from <code className="rounded bg-white/10 px-1">boing_getDexToken</code>. Deploy name / symbol
        can be merged from a bounded receipt scan
        {scanUsed && tokenIndexScan
          ? ` (last ${tokenIndexScan.toHeight - tokenIndexScan.fromHeight + 1} blocks at tip)`
          : ""}
        . Older deploys may only appear on the{" "}
        <Link href={`/tokens?network=${encodeURIComponent(network)}`} className="text-network-cyan hover:underline">
          token index
        </Link>
        {factory ? (
          <>
            . Factory{" "}
            <Link href={explorerAssetHref(factory, network)} className="font-mono text-network-cyan hover:underline">
              {shortenHash(factory, 10, 8)}
            </Link>
          </>
        ) : null}
        .
      </p>

      {onRequestScan && (
        <button
          type="button"
          onClick={onRequestScan}
          className="rounded-lg border border-[var(--border-color)] bg-white/5 px-3 py-2 text-sm text-network-cyan transition-colors hover:border-[var(--border-hover)] hover:bg-white/10"
        >
          Scan recent blocks for deploy metadata
        </button>
      )}

      {!hasBody && (
        <p className="text-sm text-[var(--text-muted)]">
          {scanUsed
            ? "No DEX listing and no deploy metadata in the scanned window for this address."
            : "No DEX listing for this address on the resolved factory. Scan recent blocks for deploy metadata, or use the token index."}
        </p>
      )}

      {dexToken && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">DEX token</h3>
          <div className="flex items-start gap-3">
            <AssetMediaThumb
              imageUrl={heroImage}
              alt={dexDisplay ? formatAssetDisplayLabel(dexDisplay, dexToken.symbol || "Token") : "Token"}
              size="md"
            />
            <dl className="grid min-w-0 flex-1 gap-2 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Symbol</dt>
              <dd>{dexDisplay?.displaySymbol || dexToken.symbol || "—"}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Name</dt>
              <dd className="break-words">{dexDisplay?.displayName || dexToken.name || "—"}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Decimals</dt>
              <dd className="font-mono">{dexToken.decimals}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Pools</dt>
              <dd className="font-mono">{dexToken.poolCount}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">firstSeenHeight</dt>
              <dd className="font-mono">
                {dexToken.firstSeenHeight != null ? (
                  <Link
                    href={explorerBlockHeightHref(dexToken.firstSeenHeight, network)}
                    className="text-network-cyan hover:underline"
                  >
                    #{dexToken.firstSeenHeight.toLocaleString()}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">metadataSource</dt>
              <dd className="font-mono text-xs">{dexToken.metadataSource ?? "—"}</dd>
            </div>
            </dl>
          </div>
        </div>
      )}

      {tokenIndex && (
        <div className="space-y-2 border-t border-[var(--border-color)] pt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Deploy index (recent blocks)</h3>
          <div className="flex items-start gap-3">
            <AssetMediaThumb
              imageUrl={heroImage}
              alt={indexDisplay ? formatAssetDisplayLabel(indexDisplay, "Asset") : "Asset"}
              size="md"
              kind={tokenIndex.kind}
            />
            <div className="min-w-0 flex-1 space-y-2">
          {tokenIndex.kind === "nft" && (
            <p className="text-xs text-[var(--text-muted)]">
              Reference NFT collections store per-token metadata on-chain. Samples below are read via{" "}
              <code className="rounded bg-white/10 px-1">boing_getContractStorage</code> for sequential token ids.
            </p>
          )}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Kind</dt>
              <dd>{formatAssetKindLabel(tokenIndex.kind)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Sources</dt>
              <dd className="font-mono text-xs">{tokenIndex.sources.join(", ")}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 sm:col-span-2">
              <dt className="text-[var(--text-muted)]">Asset name</dt>
              <dd className="break-words">
                {indexDisplay ? formatAssetDisplayLabel(indexDisplay, "—") : (tokenIndex.assetName ?? "—")}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">Symbol</dt>
              <dd>{indexDisplay?.displaySymbol ?? tokenIndex.assetSymbol ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 sm:col-span-2">
              <dt className="text-[var(--text-muted)]">Purpose</dt>
              <dd className="break-words">
                {tokenIndex.purposeCategory
                  ? formatPurposeLabel(tokenIndex.purposeCategory)
                  : "—"}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[var(--text-muted)]">First block</dt>
              <dd className="font-mono">
                <Link
                  href={explorerBlockHeightHref(tokenIndex.firstSeenBlock, network)}
                  className="text-network-cyan hover:underline"
                >
                  #{tokenIndex.firstSeenBlock.toLocaleString()}
                </Link>
              </dd>
            </div>
            {tokenIndex.deployTxId ? (
              <div className="flex flex-wrap gap-x-2 sm:col-span-2">
                <dt className="text-[var(--text-muted)]">Deploy tx</dt>
                <dd className="font-mono text-xs">
                  <Link href={explorerTxHref(tokenIndex.deployTxId, network)} className="text-network-cyan hover:underline">
                    {tokenIndex.deployTxId}
                  </Link>
                </dd>
              </div>
            ) : null}
            {tokenIndex.deployer && (
              <div className="flex flex-wrap gap-x-2 sm:col-span-2">
                <dt className="text-[var(--text-muted)]">Deployer</dt>
                <dd className="font-mono text-xs">
                  <Link href={explorerAccountHref(tokenIndex.deployer, network)} className="text-network-cyan hover:underline break-all">
                    0x{tokenIndex.deployer}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
            </div>
          </div>
        </div>
      )}

      {deployedByAccount && deployedByAccount.length > 0 && (
        <div className="space-y-3 border-t border-[var(--border-color)] pt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Deployed by this account</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {deployedByAccount.map((row) => {
              const display = parseAssetDisplayMetadata(row.assetName, row.assetSymbol);
              const label = formatAssetDisplayLabel(display, row.address.slice(0, 10));
              return (
                <li
                  key={row.address}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 p-3"
                >
                  <AssetMediaThumb
                    imageUrl={row.imageUrl ?? display.imageUrl}
                    alt={label}
                    size="md"
                    kind={row.kind}
                  />
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={explorerAssetHref(row.address, network)}
                      className="font-medium text-network-cyan hover:underline"
                    >
                      {label}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)]">{formatAssetKindLabel(row.kind)}</p>
                    {row.purposeCategory ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Purpose: {formatPurposeLabel(row.purposeCategory)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {nftSamples && nftSamples.length > 0 && (
        <div className="space-y-3 border-t border-[var(--border-color)] pt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Minted NFTs</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Each tile opens that token&apos;s profile (collection + opaque token id). Hash-based ids
            (FreshMint) appear when their mint calldata is in the recent scan window.
          </p>
          {nftDiscoverNote ? (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{nftDiscoverNote}</p>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nftSamples.map((sample) => {
              const title =
                sample.metadataName != null
                  ? parseAssetDisplayMetadata(sample.metadataName).displayName ?? sample.metadataName
                  : null;
              const metaHex =
                typeof sample.metadataHash === "string" ? sample.metadataHash.replace(/^0x/i, "") : "";
              const tokenWord =
                typeof sample.tokenIdWord === "string"
                  ? sample.tokenIdWord.replace(/^0x/i, "").toLowerCase()
                  : "";
              const label =
                sample.tokenIdU64 != null
                  ? `Token #${sample.tokenIdU64}`
                  : tokenWord
                    ? `Token ${shortenHash(tokenWord, 8, 6)}`
                    : "Token";
              const href =
                tokenWord.length === 64
                  ? explorerNftItemHref(profile.address, tokenWord, network)
                  : null;
              const body = (
                <>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    {label}
                    {title ? ` · ${title}` : ""}
                  </p>
                  <div className="mt-2">
                    <AssetMediaThumb
                      imageUrl={sample.imageUrl}
                      alt={title ?? label}
                      size="md"
                      kind="nft"
                    />
                  </div>
                  {!sample.imageUrl ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)] font-mono break-all">
                      {metaHex.length === 64
                        ? `metadata: ${shortenHash(metaHex, 12, 10)}`
                        : sample.owner
                          ? "Minted · no metadata URI set"
                          : "No image metadata"}
                    </p>
                  ) : null}
                  {sample.owner ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Owner{" "}
                      <Link
                        href={explorerAccountHref(sample.owner, network)}
                        className="font-mono text-network-cyan hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {shortenHash(sample.owner)}
                      </Link>
                    </p>
                  ) : null}
                </>
              );
              return (
                <li key={tokenWord || String(sample.tokenIdU64) || metaHex}>
                  {href ? (
                    <Link
                      href={href}
                      className="block rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 p-3 transition hover:border-network-cyan/50 hover:bg-boing-navy-mid/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 p-3">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {indexWarnings && indexWarnings.length > 0 && (
        <details className="text-xs text-[var(--text-muted)]">
          <summary className="cursor-pointer text-[var(--text-secondary)]">Index warnings ({indexWarnings.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {indexWarnings.map((w) => (
              <li key={w} className="break-words">
                {w}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
