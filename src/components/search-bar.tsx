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
  /** Outer width classes (default `max-w-xl`; header passes `max-w-none` to use flex space). */
  className?: string;
};

export function SearchBar({ layout = "inline", className = "max-w-xl" }: SearchBarProps) {
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
        className={stacked ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}
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
              : "Block height, or 64 hex (tx id, block hash, asset)"
          }
          className="hash min-h-11 w-full flex-1 rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary sm:px-4"
          aria-label="Search by block height, transaction id, block hash, or asset address"
          autoComplete="off"
          data-testid="explorer-search-input"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label={loading ? "Searching…" : "Search"}
          data-testid="explorer-search-submit"
          className={`min-h-11 shrink-0 rounded-lg bg-network-primary px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-network-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-network-cyan disabled:opacity-60 ${
            stacked ? "w-full" : "w-full sm:w-auto"
          }`}
        >
          {loading ? "…" : "Search"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}
