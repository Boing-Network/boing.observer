"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { ExplorerHexLink } from "@/components/explorer-hex-link";
import { explorerAssetHref, explorerBlockHeightHref, explorerTxHref } from "@/lib/explorer-href";
import { formatAssetDisplayLabel, parseAssetDisplayMetadata } from "@/lib/extract-media-url";
import { shortenHash } from "@/lib/rpc-types";
import type { TokenIndexCacheMeta, TokenIndexJsonEntry, TokenIndexResult } from "@/lib/token-index/types";
import { AssetMediaThumb } from "@/components/asset-media-thumb";

function tokenVisual(
  row: TokenIndexJsonEntry,
  extra?: { imageUrl?: string; description?: string } | null,
  fallbackImage?: string | null,
) {
  const display = parseAssetDisplayMetadata(row.assetName, row.assetSymbol);
  return {
    ...display,
    imageUrl: extra?.imageUrl || row.imageUrl || display.imageUrl || fallbackImage || null,
    description: extra?.description || display.description,
  };
}

const WINDOW_OPTIONS = [256, 512, 1024, 2048] as const;

export function TokensIndexPanel() {
  const { network } = useNetwork();
  const [windowBlocks, setWindowBlocks] = useState<number>(1024);
  const [data, setData] = useState<(TokenIndexResult & { note?: string; cacheMeta?: TokenIndexCacheMeta }) | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    setLoading(true);
    setError(null);
    if (opts?.refresh) setData(null);
    try {
      const u = new URL("/api/tokens/index", window.location.origin);
      u.searchParams.set("network", network);
      u.searchParams.set("window", String(windowBlocks));
      if (opts?.refresh) u.searchParams.set("refresh", "1");
      const res = await fetch(u.toString());
      const json = (await res.json()) as TokenIndexResult & {
        note?: string;
        cacheMeta?: TokenIndexCacheMeta;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [network, windowBlocks]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = data?.entries ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const display = parseAssetDisplayMetadata(row.assetName, row.assetSymbol);
      const hay = [
        row.address,
        row.assetName ?? "",
        row.assetSymbol ?? "",
        display.displayName ?? "",
        display.displaySymbol ?? "",
        row.purposeCategory ?? "",
        row.deployer ?? "",
        row.deployTxId ?? "",
        row.kind,
        row.sources.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.entries, filter]);

  const [extraMeta, setExtraMeta] = useState<Record<string, { imageUrl?: string; description?: string }>>({});
  const attemptedMeta = useRef<Set<string>>(new Set());
  useEffect(() => {
    attemptedMeta.current = new Set();
    setExtraMeta({});
  }, [data]);
  useEffect(() => {
    const missing = filtered.filter((row) => {
      const key = row.descriptionHash ?? "";
      if (!key || attemptedMeta.current.has(row.address)) return false;
      if (extraMeta[row.address]?.imageUrl || row.imageUrl) return false;
      return !parseAssetDisplayMetadata(row.assetName, row.assetSymbol).imageUrl;
    });
    if (missing.length === 0) return;
    for (const row of missing) attemptedMeta.current.add(row.address);
    let cancelled = false;
    void Promise.all(
      missing.slice(0, 24).map(async (row) => {
        const res = await fetch(`/api/asset/metadata?hash=${encodeURIComponent(row.descriptionHash!)}`);
        const json = (await res.json()) as {
          found?: boolean;
          imageUrl?: string | null;
          description?: string | null;
        };
        if (json.found && (json.imageUrl || json.description)) {
          return [row.address, { imageUrl: json.imageUrl ?? undefined, description: json.description ?? undefined }] as const;
        }
        return null;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, { imageUrl?: string; description?: string }> = {};
      for (const pair of pairs) {
        if (pair) next[pair[0]] = pair[1];
      }
      if (Object.keys(next).length) setExtraMeta((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [filtered, extraMeta]);

  const imageByLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.entries ?? []) {
      const visual = tokenVisual(row, extraMeta[row.address]);
      const key = `${visual.displayName ?? ""}|${visual.displaySymbol ?? ""}`.toLowerCase();
      if (visual.imageUrl && key !== "|") map.set(key, visual.imageUrl);
    }
    return map;
  }, [data?.entries, extraMeta]);

  return (
    <div className="space-y-8">
      <div className="glass-card space-y-4 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Scan depth</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          The observer walks blocks with receipts and merges native DEX{" "}
          <code className="rounded bg-white/10 px-1 text-xs">register_pair</code> logs for the same heights. Matching
          snapshots are reused from disk for a TTL (default 10 minutes) so repeat visits are fast. Use{" "}
          <strong className="text-[var(--text-primary)]">Rescan</strong> to bypass cache and hit RPC again.
        </p>
        <div className="flex flex-wrap gap-2">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowBlocks(w)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                windowBlocks === w
                  ? "border-network-cyan bg-network-cyan/15 text-network-cyan"
                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
              }`}
            >
              Last {w} blocks
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => load({ refresh: true })}
            disabled={loading}
            className="rounded-lg bg-network-primary px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-network-primary-light disabled:opacity-60"
          >
            {loading ? "Scanning…" : "Rescan (refresh cache)"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">Network: {network}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/25 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {data && !error && data.indexWarnings && data.indexWarnings.length > 0 && (
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          <p className="font-medium text-amber-200">Index notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--text-secondary)] leading-relaxed">
            {data.indexWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {data && !error && data.cacheMeta && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
            data.cacheMeta.hit
              ? "border-network-cyan/40 bg-network-cyan/10 text-[var(--text-secondary)]"
              : "border-[var(--border-color)] bg-boing-navy-mid/40 text-[var(--text-secondary)]"
          }`}
          role="status"
        >
          {data.cacheMeta.hit ? (
            <p>
              <strong className="text-network-cyan">Cached snapshot</strong> — served from disk (no full RPC scan this
              request). Saved {data.cacheMeta.savedAt ? new Date(data.cacheMeta.savedAt).toLocaleString() : "—"} · stale
              after ~{data.cacheMeta.staleAfterApprox ? new Date(data.cacheMeta.staleAfterApprox).toLocaleString() : "—"}.
            </p>
          ) : (
            <p>
              <strong className="text-[var(--text-primary)]">Fresh RPC scan</strong>
              {data.cacheMeta.snapshotPersisted === true
                ? " — snapshot written to disk for reuse."
                : data.cacheMeta.snapshotPersisted === false
                  ? " — disk cache is enabled but this snapshot could not be written (read-only filesystem?)."
                  : " — disk cache disabled (set a writable TOKEN_INDEX_CACHE_DIR or use default .cache)."}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Chain tip now #{data.cacheMeta.currentHeadHeight.toLocaleString()} · scan covered through #
            {data.scannedToHeight.toLocaleString()}
            {data.cacheMeta.blocksPastScanTip > 0
              ? ` · ${data.cacheMeta.blocksPastScanTip} new block(s) since scan tip (widen window or rescan).`
              : ""}
          </p>
        </div>
      )}

      {data && !error && (
        <>
          <div className="grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Head height" value={data.headHeight.toLocaleString()} />
            <Stat label="Scanned blocks" value={`${data.scannedFromHeight.toLocaleString()} – ${data.scannedToHeight.toLocaleString()}`} />
            <Stat label="Blocks loaded" value={data.blockBundlesFetched.toLocaleString()} />
            <Stat label="DEX register rows" value={data.dexRegisterRows.toLocaleString()} />
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{data.note}</p>

          <div className="glass-card space-y-3 p-4 sm:p-6">
            <label className="block text-sm font-medium text-[var(--text-secondary)]" htmlFor="token-filter">
              Filter (name, symbol, address, tx id, kind…)
            </label>
            <input
              id="token-filter"
              name="token-filter"
              type="search"
              autoComplete="off"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search this result set…"
              className="hash w-full max-w-xl rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary"
            />
          </div>

          <section className="glass-card p-4 sm:p-6" aria-labelledby="token-table-heading">
            <h2 id="token-table-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Assets ({filtered.length}
              {filtered.length !== data.entries.length ? ` of ${data.entries.length}` : ""})
            </h2>
            {filtered.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                {data.entries.length === 0 ? (
                  <>
                    No included contract deploys in this window. Mempool accept on boing.finance is not enough — wait for
                    a block, then Rescan. DEX-listed tokens need a published factory; see{" "}
                    <Link href="/dex/tokens" className="text-network-cyan hover:underline">
                      DEX token directory
                    </Link>
                    .
                  </>
                ) : (
                  "No entries match this filter."
                )}
              </p>
            ) : (
              <>
                <div className="data-card-list mt-4 md:hidden">
                  {filtered.map((row) => {
                    const extra = extraMeta[row.address];
                    const visual = tokenVisual(row, extra);
                    const fallback = imageByLabel.get(
                      `${visual.displayName ?? ""}|${visual.displaySymbol ?? ""}`.toLowerCase(),
                    );
                    return (
                    <TokenCard
                      key={row.address}
                      row={row}
                      network={network}
                      extra={extra}
                      fallbackImage={fallback}
                    />
                    );
                  })}
                </div>
                <div className="table-scroll-wrap mt-4 hidden md:block">
                  <p className="table-scroll-hint">Swipe horizontally to see all columns</p>
                  <table className="w-full min-w-[48rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                        <th className="w-14 pb-2 pr-3 font-medium"> </th>
                        <th className="pb-2 pr-3 font-medium">Asset</th>
                        <th className="pb-2 pr-3 font-medium">Kind</th>
                        <th className="pb-2 pr-3 font-medium">Sources</th>
                        <th className="pb-2 pr-3 font-medium">First block</th>
                        <th className="pb-2 pr-3 font-medium">Deploy tx</th>
                        <th className="pb-2 font-medium">Deployer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => {
                        const extra = extraMeta[row.address];
                        const visual = tokenVisual(row, extra);
                        const fallback = imageByLabel.get(
                          `${visual.displayName ?? ""}|${visual.displaySymbol ?? ""}`.toLowerCase(),
                        );
                        return (
                          <TokenRow
                            key={row.address}
                            row={row}
                            network={network}
                            extra={extra}
                            fallbackImage={fallback}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/40 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 font-mono text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function TokenCard({
  row,
  network,
  extra,
  fallbackImage,
}: {
  row: TokenIndexJsonEntry;
  network: string;
  extra?: { imageUrl?: string; description?: string };
  fallbackImage?: string;
}) {
  const display = tokenVisual(row, extra, fallbackImage);
  const title = formatAssetDisplayLabel(display, "—");
  return (
    <div className="data-card space-y-2">
      <div className="flex items-start gap-3">
        <AssetMediaThumb imageUrl={display.imageUrl} alt={title} size="md" kind={row.kind} />
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={explorerAssetHref(row.address, network)}
            className="font-medium text-network-cyan hover:underline"
          >
            {title}
          </Link>
          <ExplorerHexLink value={row.address} network={network} kind="asset" head={12} tail={10} copy />
          {display.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">{display.description}</p>
          ) : null}
        </div>
      </div>
      <div className="data-card__row">
        <span className="data-card__label">Kind</span>
        <span className="data-card__value font-mono">{row.kind}</span>
      </div>
      <div className="data-card__row">
        <span className="data-card__label">Sources</span>
        <span className="data-card__value">{row.sources.join(", ")}</span>
      </div>
      <div className="data-card__row">
        <span className="data-card__label">First block</span>
        <span className="data-card__value">
          <Link
            href={explorerBlockHeightHref(row.firstSeenBlock, network)}
            className="font-mono text-network-cyan hover:underline"
          >
            #{row.firstSeenBlock.toLocaleString()}
          </Link>
        </span>
      </div>
      {row.deployTxId ? (
        <div className="data-card__row">
          <span className="data-card__label">Deploy tx</span>
          <span className="data-card__value">
            <Link href={explorerTxHref(row.deployTxId, network)} className="hash font-mono text-network-cyan hover:underline">
              {shortenHash(row.deployTxId, 10, 8)}
            </Link>
          </span>
        </div>
      ) : null}
      {row.deployer ? (
        <div className="data-card__row">
          <span className="data-card__label">Deployer</span>
          <span className="data-card__value">
            <ExplorerHexLink value={row.deployer} network={network} kind="account" />
          </span>
        </div>
      ) : null}
    </div>
  );
}

function TokenRow({
  row,
  network,
  extra,
  fallbackImage,
}: {
  row: TokenIndexJsonEntry;
  network: string;
  extra?: { imageUrl?: string; description?: string };
  fallbackImage?: string;
}) {
  const display = tokenVisual(row, extra, fallbackImage);
  const title = formatAssetDisplayLabel(display, "—");
  return (
    <tr className="border-b border-[var(--border-color)]/60">
      <td className="py-2 pr-2 align-top w-14">
        <AssetMediaThumb imageUrl={display.imageUrl} alt={title} size="md" kind={row.kind} />
      </td>
      <td className="py-2 pr-3 align-top">
        <div className="space-y-1">
          <Link
            href={explorerAssetHref(row.address, network)}
            className="font-medium text-network-cyan hover:underline"
          >
            {title}
          </Link>
          <ExplorerHexLink value={row.address} network={network} kind="asset" head={12} tail={10} copy />
          {row.purposeCategory ? (
            <p className="text-xs text-[var(--text-muted)]">Purpose: {row.purposeCategory}</p>
          ) : null}
          {display.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">{display.description}</p>
          ) : null}
        </div>
      </td>
      <td className="py-2 pr-3 align-top font-mono text-xs text-[var(--text-secondary)]">{row.kind}</td>
      <td className="py-2 pr-3 align-top text-xs text-[var(--text-secondary)]">{row.sources.join(", ")}</td>
      <td className="py-2 pr-3 align-top font-mono text-xs">
        <Link href={explorerBlockHeightHref(row.firstSeenBlock, network)} className="text-network-cyan hover:underline">
          #{row.firstSeenBlock.toLocaleString()}
        </Link>
      </td>
      <td className="py-2 pr-3 align-top">
        {row.deployTxId ? (
          <Link href={explorerTxHref(row.deployTxId, network)} className="hash font-mono text-xs text-network-cyan hover:underline">
            {shortenHash(row.deployTxId, 10, 8)}
          </Link>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td className="py-2 align-top">
        {row.deployer ? (
          <ExplorerHexLink value={row.deployer} network={network} kind="account" />
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
