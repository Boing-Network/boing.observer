"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHash, fetchTransactionReceipt } from "@/lib/rpc-methods";
import { explorerAssetHref } from "@/lib/explorer-href";
import { isHex64, normalizeHex64, type NetworkId } from "@/lib/rpc-types";

const HEIGHT = /^\d+$/;

type SearchBarProps = {
  /** Use vertical layout for narrow panels (e.g. mobile menu). */
  layout?: "inline" | "stacked";
  /** Outer width classes (default `max-w-lg`; header passes `max-w-none` inside a capped flex slot). */
  className?: string;
  /** Compact (`sm`) for the sticky header; `md` for page bodies. */
  size?: "sm" | "md";
};

export function SearchBar({ layout = "inline", className = "max-w-lg", size = "md" }: SearchBarProps) {
  const router = useRouter();
  const { network } = useNetwork();
  const uid = useId();
  const fieldId = `explorer-search-${uid.replace(/:/g, "")}`;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stacked = layout === "stacked";

  const search = useCallback(async () => {
    const q = value.trim();
    setError("");
    if (!q) return;
    if (HEIGHT.test(q)) {
      router.push(`/block/${q}?network=${network}`);
      return;
    }
    if (isHex64(q)) {
      const hex = normalizeHex64(q);
      setLoading(true);
      try {
        const [txSettled, blockSettled] = await Promise.allSettled([
          fetchTransactionReceipt(network as NetworkId, hex),
          fetchBlockByHash(network as NetworkId, hex),
        ]);
        if (txSettled.status === "fulfilled" && txSettled.value) {
          router.push(`/tx/${hex}?network=${network}`);
          return;
        }
        if (blockSettled.status === "fulfilled" && blockSettled.value) {
          router.push(`/block/hash/${hex}?network=${network}`);
          return;
        }
        router.push(explorerAssetHref(hex, network));
      } catch {
        router.push(explorerAssetHref(hex, network));
      } finally {
        setLoading(false);
      }
      return;
    }
    setError(
      "Enter a block height (number), or 64 hex (transaction id, block hash, or asset / account address — we try tx first)."
    );
  }, [value, network, router]);

  return (
    <div className={`w-full ${className}`}>
      <form
        role="search"
        className={
          stacked
            ? "flex w-full flex-col gap-2"
            : "flex w-full min-w-0 flex-row gap-1.5"
        }
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          id={fieldId}
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            stacked
              ? "Height or 64-char hex (tx / block / asset address)"
              : "Block height, tx, block hash, or asset"
          }
          className={
            size === "sm"
              ? "hash min-h-9 w-full flex-1 rounded-md border border-[var(--border-color)] bg-boing-navy-mid/80 px-2.5 py-1.5 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary"
              : "hash min-h-10 w-full flex-1 rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary"
          }
          aria-label="Search by block height, transaction id, block hash, or asset address"
          autoComplete="off"
          data-testid="explorer-search-input"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label={loading ? "Searching…" : "Search"}
          data-testid="explorer-search-submit"
          className={`shrink-0 rounded-md bg-network-primary font-display font-semibold text-white hover:bg-network-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-network-cyan disabled:opacity-60 ${
            size === "sm" ? "min-h-9 px-3 py-1.5 text-sm" : "min-h-10 px-3.5 py-2 text-sm"
          } ${stacked ? "w-full" : "w-auto"}`}
        >
          {loading ? "…" : "Search"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}
