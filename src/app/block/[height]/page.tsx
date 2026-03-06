"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHeight } from "@/lib/rpc-methods";
import type { Block } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { BlockDetails } from "@/components/block-details";

export default function BlockByHeightPage() {
  const params = useParams();
  const { network } = useNetwork();
  const heightParam = params?.height as string;
  const height = heightParam ? parseInt(heightParam, 10) : NaN;
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(height) || height < 0) {
      setLoading(false);
      setError("Invalid block height");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBlockByHeight(network, height)
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
  }, [network, height]);

  if (Number.isNaN(height) || height < 0) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-network-cyan hover:underline text-sm">← Home</Link>
        <p className="text-red-400">Invalid block height.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="text-network-cyan hover:underline text-sm">← Home</Link>

      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Block #{height.toLocaleString()}
      </h1>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-48" />
          <div className="h-64 bg-white/5 rounded" />
          <div className="h-48 bg-white/5 rounded" />
        </div>
      )}
      {error && <p className="text-amber-300" role="alert">{error}</p>}
      {!loading && !error && !block && <p className="text-[var(--text-muted)]">Block not found.</p>}

      {block && <BlockDetails block={block} network={network} />}
    </div>
  );
}
