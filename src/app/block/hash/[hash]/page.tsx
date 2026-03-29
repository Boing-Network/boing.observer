"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHash } from "@/lib/rpc-methods";
import type { Block } from "@/lib/rpc-types";
import { isHex64, normalizeHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { CopyButton } from "@/components/copy-button";
import { BlockDetails } from "@/components/block-details";

export default function BlockByHashPage() {
  const params = useParams();
  const { network } = useNetwork();
  const hashParam = params?.hash as string;
  const hash = hashParam ? normalizeHex64(hashParam) : "";
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHex64(hashParam || "")) {
      setLoading(false);
      setError("Invalid block hash");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBlockByHash(network, hash)
      .then((b) => {
        if (!cancelled) setBlock(b ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyRpcErrorMessage(e, network, "block"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [network, hash]);

  if (!isHex64(hashParam || "")) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-network-cyan hover:underline text-sm">← Home</Link>
        <p className="text-red-400">Invalid block hash (must be 64 hex characters).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="text-network-cyan hover:underline text-sm">← Home</Link>

      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Block by hash
      </h1>
      <p className="text-sm text-[var(--text-muted)] -mt-2">
        BLAKE3 block identifier — not an EVM-style transaction hash. On-chain transfers appear in the
        transactions table below.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="hash text-sm text-[var(--text-muted)] break-all">{hash}</p>
        <CopyButton value={`0x${hash}`} label="Copy hash" />
      </div>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-48" />
          <div className="h-64 bg-white/5 rounded" />
          <div className="h-48 bg-white/5 rounded" />
        </div>
      )}
      {error && <p className="text-amber-300" role="alert">{error}</p>}
      {!loading && !error && !block && <p className="text-[var(--text-muted)]">Block not found.</p>}

      {block && <BlockDetails block={block} network={network} explainerVariant="by-hash" />}
    </div>
  );
}
