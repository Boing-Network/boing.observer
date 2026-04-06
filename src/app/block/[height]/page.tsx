"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHeight, fetchNetworkInfo } from "@/lib/rpc-methods";
import type { Block, BoingNetworkInfo } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { BlockDetails } from "@/components/block-details";

export default function BlockByHeightPage() {
  const params = useParams();
  const { network } = useNetwork();
  const heightParam = params?.height as string;
  const height = heightParam ? parseInt(heightParam, 10) : NaN;
  const [block, setBlock] = useState<Block | null>(null);
  const [netInfo, setNetInfo] = useState<BoingNetworkInfo | null>(null);
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
    void Promise.allSettled([fetchBlockByHeight(network, height, true), fetchNetworkInfo(network)])
      .then((results) => {
        if (cancelled) return;
        const [blockRes, infoRes] = results;
        if (blockRes.status === "fulfilled") {
          setBlock(blockRes.value ?? null);
        } else {
          setBlock(null);
          setError(getFriendlyRpcErrorMessage(blockRes.reason, network, "block"));
        }
        if (infoRes.status === "fulfilled") setNetInfo(infoRes.value);
        else setNetInfo(null);
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
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <p className="text-red-400" role="alert">
          Invalid block height.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
          Block #{height.toLocaleString()}
        </h1>
      </header>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-8 bg-white/5 rounded w-48" />
          <div className="h-64 bg-white/5 rounded" />
          <div className="h-48 bg-white/5 rounded" />
        </div>
      )}
      {error && <p className="text-amber-300" role="alert">{error}</p>}
      {!loading && !error && !block && <p className="text-[var(--text-muted)]">Block not found.</p>}

      {block ? (
        <section aria-label="Block details and transactions">
          <BlockDetails
            block={block}
            network={network}
            explainerVariant="by-height"
            consensusHint={{
              validatorCount: netInfo?.consensus?.validator_count ?? null,
              model: netInfo?.consensus?.model,
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
