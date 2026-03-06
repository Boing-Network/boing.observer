"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHash } from "@/lib/rpc-methods";
import { isHex64, normalizeHex64, type NetworkId } from "@/lib/rpc-types";

const HEIGHT = /^\d+$/;

export function SearchBar() {
  const router = useRouter();
  const { network } = useNetwork();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setError("Enter a block height (number), block hash (64 hex), or account address (64 hex).");
  }, [value, network, router]);

  return (
    <div className="w-full max-w-xl">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Block height, block hash, or account address (64 hex)"
          className="hash flex-1 rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary"
          aria-label="Search by block height, block hash, or account address"
        />
        <button
          type="button"
          onClick={() => search()}
          disabled={loading}
          aria-label={loading ? "Searching…" : "Search"}
          className="rounded-lg bg-network-primary px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-network-primary-light transition-colors focus:outline-none focus:ring-2 focus:ring-network-cyan disabled:opacity-60"
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}
