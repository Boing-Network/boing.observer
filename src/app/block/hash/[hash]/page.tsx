"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHash, fetchNetworkInfo } from "@/lib/rpc-methods";
import type { Block, BoingNetworkInfo } from "@/lib/rpc-types";
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
  const [netInfo, setNetInfo] = useState<BoingNetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHex64(hash)) {
      setLoading(false);
      setError("Invalid block hash");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.allSettled([fetchBlockByHash(network, hash, true), fetchNetworkInfo(network)])
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
  }, [network, hash]);

  if (!isHex64(hashParam || "")) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <p className="text-red-400" role="alert">
          Invalid block hash (64 hex characters).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Block by hash</h1>
        <p className="max-w-2xl text-sm text-[var(--text-muted)]">BLAKE3 block id (64 hex). Transfers live under Transactions.</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="hash break-all text-sm text-[var(--text-secondary)]">{hash}</p>
          <CopyButton value={`0x${hash}`} label="Copy hash" />
        </div>
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
            explainerVariant="by-hash"
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
