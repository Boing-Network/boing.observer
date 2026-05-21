"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { explorerAssetHref } from "@/lib/explorer-href";
import { resolveImageUrlFromSources } from "@/lib/extract-media-url";
import { shortenHash } from "@/lib/rpc-types";
import type { TokenIndexCacheMeta, TokenIndexJsonEntry, TokenIndexResult } from "@/lib/token-index/types";

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
      const hay = [
        row.address,
        row.assetName ?? "",
        row.assetSymbol ?? "",
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
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search this result set…"
              className="hash w-full max-w-xl rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary"
            />
          </div>

          <section className="glass-card overflow-x-auto p-4 sm:p-6" aria-labelledby="token-table-heading">
            <h2 id="token-table-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Assets ({filtered.length}
              {filtered.length !== data.entries.length ? ` of ${data.entries.length}` : ""})
            </h2>
            {filtered.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                No entries in this window. Try a deeper scan or check another network.
              </p>
            ) : (
              <table className="mt-4 w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                    <th className="pb-2 pr-3 font-medium w-14"> </th>
                    <th className="pb-2 pr-3 font-medium">Asset</th>
                    <th className="pb-2 pr-3 font-medium">Kind</th>
                    <th className="pb-2 pr-3 font-medium">Sources</th>
                    <th className="pb-2 pr-3 font-medium">First block</th>
                    <th className="pb-2 pr-3 font-medium">Deploy tx</th>
                    <th className="pb-2 font-medium">Deployer</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <TokenRow key={row.address} row={row} network={network} />
                  ))}
                </tbody>
              </table>
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

function TokenRow({ row, network }: { row: TokenIndexJsonEntry; network: string }) {
  const title = [row.assetName, row.assetSymbol].filter(Boolean).join(" · ") || "—";
  const thumbUrl = resolveImageUrlFromSources(row.assetName, row.assetSymbol);
  return (
    <tr className="border-b border-[var(--border-color)]/60">
      <td className="py-2 pr-2 align-top w-14">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- token logo from deploy metadata
          <img
            src={thumbUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded border border-[var(--border-color)] object-contain bg-black/20"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--border-color)] bg-boing-navy-mid/50 text-[10px] uppercase text-[var(--text-muted)]"
            aria-hidden
          >
            {row.kind === "nft" ? "NFT" : "TKN"}
          </span>
        )}
      </td>
      <td className="py-2 pr-3 align-top">
        <div className="space-y-1">
          <Link
            href={explorerAssetHref(row.address, network)}
            className="font-medium text-network-cyan hover:underline"
          >
            {title}
          </Link>
          <p className="hash font-mono text-xs text-[var(--text-muted)]">{shortenHash(row.address, 12, 10)}</p>
          {row.purposeCategory ? (
            <p className="text-xs text-[var(--text-muted)]">Purpose: {row.purposeCategory}</p>
          ) : null}
        </div>
      </td>
      <td className="py-2 pr-3 align-top font-mono text-xs text-[var(--text-secondary)]">{row.kind}</td>
      <td className="py-2 pr-3 align-top text-xs text-[var(--text-secondary)]">{row.sources.join(", ")}</td>
      <td className="py-2 pr-3 align-top font-mono text-xs">
        <Link href={`/block/${row.firstSeenBlock}?network=${network}`} className="text-network-cyan hover:underline">
          #{row.firstSeenBlock.toLocaleString()}
        </Link>
      </td>
      <td className="py-2 pr-3 align-top">
        {row.deployTxId ? (
          <Link
            href={`/tx/${row.deployTxId}?network=${network}`}
            className="hash font-mono text-xs text-network-cyan hover:underline"
          >
            {shortenHash(row.deployTxId, 10, 8)}
          </Link>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td className="py-2 align-top">
        {row.deployer ? (
          <Link href={explorerAssetHref(row.deployer, network)} className="address-link text-xs">
            {shortenHash(row.deployer)}
          </Link>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
