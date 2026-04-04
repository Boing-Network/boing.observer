"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchBlockByHeight, fetchTransactionReceipt } from "@/lib/rpc-methods";
import type { Block, BlockTransaction, TransactionReceipt } from "@/lib/rpc-types";
import { isHex64, normalizeHex64, toPrefixedHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { CopyButton } from "@/components/copy-button";
import { TransactionInsight } from "@/components/transaction-insight";

export default function TransactionByIdPage() {
  const params = useParams();
  const { network } = useNetwork();
  const rawParam = params?.txId as string;
  const txId = rawParam ? normalizeHex64(decodeURIComponent(rawParam)) : "";

  const [receipt, setReceipt] = useState<TransactionReceipt | null | undefined>(undefined);
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHex64(rawParam || "")) {
      setLoading(false);
      setReceipt(null);
      setBlock(null);
      setError("Invalid transaction id");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlock(null);
    setReceipt(undefined);

    fetchTransactionReceipt(network, txId)
      .then(async (r) => {
        if (cancelled) return;
        setReceipt(r ?? null);
        if (!r || r.block_height == null) {
          setBlock(null);
          return;
        }
        try {
          const b = await fetchBlockByHeight(network, r.block_height, true);
          if (!cancelled) setBlock(b ?? null);
        } catch (e) {
          if (!cancelled) setError(getFriendlyRpcErrorMessage(e, network, "block"));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyRpcErrorMessage(e, network, "general"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [network, txId, rawParam]);

  if (!isHex64(rawParam || "")) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-network-cyan hover:underline">
          ← Home
        </Link>
        <p className="text-red-400" role="alert">
          Invalid transaction id (must be 64 hex characters, same id returned by{" "}
          <span className="font-mono">boing_getTransactionReceipt</span>).
        </p>
      </div>
    );
  }

  const height = receipt?.block_height;
  const txIndex = receipt?.tx_index;
  const txs = block?.transactions ?? [];
  const tx: BlockTransaction | null =
    block != null && typeof txIndex === "number" && txIndex >= 0 && txIndex < txs.length
      ? txs[txIndex]!
      : null;
  const blockReceipts = block?.receipts;
  const receiptAtSlot =
    Array.isArray(blockReceipts) &&
    typeof txIndex === "number" &&
    txIndex >= 0 &&
    txIndex < blockReceipts.length
      ? blockReceipts[txIndex]
      : undefined;
  const executionReceipt = receiptAtSlot ?? receipt ?? null;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-network-cyan hover:underline">
        ← Home
      </Link>

      <header className="space-y-3">
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
          Transaction
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          32-byte signable payload hash (Boing tx id). Block hash uses the same length — search tries a
          transaction receipt first when you paste 64 hex characters.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="hash break-all text-sm text-[var(--text-secondary)]">{txId}</p>
          <CopyButton value={toPrefixedHex64(txId)} label="Copy transaction id" />
        </div>
        {height != null ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Included in{" "}
            <Link
              href={`/block/${height}?network=${network}#tx-${txIndex ?? 0}`}
              className="font-medium text-network-cyan hover:underline"
            >
              block #{height}
            </Link>
            {typeof txIndex === "number" ? (
              <>
                {" "}
                · slot <span className="font-mono">{txIndex}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      {loading && (
        <div className="space-y-4 animate-pulse" aria-busy="true">
          <div className="h-40 w-full rounded-lg bg-white/5" />
          <div className="h-64 w-full rounded-lg bg-white/5" />
        </div>
      )}

      {!loading && error ? <p className="text-amber-300" role="alert">{error}</p> : null}

      {!loading && !error && receipt === null ? (
        <p className="text-[var(--text-muted)]">
          No transaction receipt for this id on the selected network. It may be unknown, pruned, or a block
          hash rather than a tx id — try opening it as a{" "}
          <Link href={`/block/hash/${txId}?network=${network}`} className="text-network-cyan hover:underline">
            block by hash
          </Link>{" "}
          or{" "}
          <Link href={`/account/${txId}?network=${network}`} className="text-network-cyan hover:underline">
            account
          </Link>
          .
        </p>
      ) : null}

      {!loading && !error && receipt != null && height == null ? (
        <p className="text-[var(--text-muted)]">
          A receipt was returned without a <span className="font-mono">block_height</span> field, so the
          signed transaction payload cannot be shown here. Check your RPC node version or try another
          endpoint.
        </p>
      ) : null}

      {!loading && !error && receipt != null && block === null && height != null ? (
        <p className="text-[var(--text-muted)]">
          Receipt references block #{height}, but that block was not returned by the node. Try again or open{" "}
          <Link href={`/block/${height}?network=${network}`} className="text-network-cyan hover:underline">
            block #{height}
          </Link>
          .
        </p>
      ) : null}

      {!loading && !error && receipt != null && block != null && tx == null ? (
        <p className="text-[var(--text-muted)]" role="status">
          Block loaded, but no transaction at receipt index{" "}
          <span className="font-mono">{String(txIndex)}</span>. The node may have returned an inconsistent
          receipt.
        </p>
      ) : null}

      {!loading && !error && tx != null && typeof txIndex === "number" && height != null ? (
        <TransactionInsight
          tx={tx}
          index={txIndex}
          network={network}
          receipt={executionReceipt ?? null}
          receiptsWereRequested
          visualScale="featured"
          blockPlacement={{ height, txIndex }}
        />
      ) : null}
    </div>
  );
}
