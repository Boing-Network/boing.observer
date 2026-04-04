"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHash, fetchTransactionReceipt } from "@/lib/rpc-methods";
import { isHex64, normalizeHex64, type NetworkId } from "@/lib/rpc-types";

const HEIGHT = /^\d+$/;

type SearchBarProps = {
  /** Use vertical layout for narrow panels (e.g. mobile menu). */
  layout?: "inline" | "stacked";
  className?: string;
};

export function SearchBar({ layout = "inline", className = "" }: SearchBarProps) {
  const router = useRouter();
  const { network } = useNetwork();
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
        const txReceipt = await fetchTransactionReceipt(network as NetworkId, hex);
        if (txReceipt) {
          router.push(`/tx/${hex}?network=${network}`);
          return;
        }
        const block = await fetchBlockByHash(network as NetworkId, hex);
        if (block) router.push(`/block/hash/${hex}?network=${network}`);
        else router.push(`/account/${hex}?network=${network}`);
      } catch {
        router.push(`/account/${hex}?network=${network}`);
      } finally {
        setLoading(false);
      }
      return;
    }
    setError(
      "Enter a block height (number), or 64 hex (transaction id, block hash, or account — we try tx first)."
    );
  }, [value, network, router]);

  return (
    <div className={`w-full max-w-xl ${className}`}>
      <div className={stacked ? "flex flex-col gap-2" : "flex gap-2"}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder={
            stacked
              ? "Height or 64-char hex (tx / block / account)"
              : "Block height, or 64 hex (tx id, block hash, address)"
          }
          className="hash min-h-11 w-full flex-1 rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary sm:px-4"
          aria-label="Search by block height, transaction id, block hash, or account address"
        />
        <button
          type="button"
          onClick={() => search()}
          disabled={loading}
          aria-label={loading ? "Searching…" : "Search"}
          className={`min-h-11 shrink-0 rounded-lg bg-network-primary px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-network-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-network-cyan disabled:opacity-60 ${
            stacked ? "w-full" : ""
          }`}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}
