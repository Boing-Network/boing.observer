"use client";

import Link from "next/link";
import type { Block } from "@/lib/rpc-types";
import { shortenHash, hexForLink, toPrefixedHex64 } from "@/lib/rpc-types";
import { CopyButton } from "@/components/copy-button";
import { BlockExplainerBanner } from "@/components/block-explainer";
import { TransactionInsight } from "@/components/transaction-insight";

export function BlockDetails({
  block,
  network,
  explainerVariant,
}: {
  block: Block;
  network: string;
  explainerVariant?: "by-hash" | "by-height";
}) {
  const proposerHex = hexForLink(block.header.proposer);
  const parentHash = hexForLink(block.header.parent_hash);
  const blockHash = hexForLink(block.hash);
  const txs = block.transactions ?? [];
  const receipts = block.receipts;
  const receiptsWereRequested = Array.isArray(receipts);

  return (
    <>
      {explainerVariant ? <BlockExplainerBanner variant={explainerVariant} /> : null}
      <div className="glass-card space-y-4 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Header</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-x-2 items-center gap-y-1">
            <dt className="text-[var(--text-muted)]">Hash</dt>
            <dd className="hash text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
              {blockHash ? (
                <>
                  <Link href={`/block/hash/${blockHash}?network=${network}`} className="text-network-cyan hover:underline">
                    {shortenHash(block.hash)}
                  </Link>
                  <CopyButton value={toPrefixedHex64(blockHash)} label="Copy hash" />
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-[var(--text-muted)]">Height</dt>
            <dd className="font-mono">
              <Link href={`/block/${block.header.height}?network=${network}`} className="text-network-cyan hover:underline">
                {block.header.height}
              </Link>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-[var(--text-muted)]">Timestamp</dt>
            <dd className="font-mono">
              {block.header.timestamp != null
                ? new Date(Number(block.header.timestamp) * 1000).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2 items-center gap-y-1">
            <dt className="text-[var(--text-muted)]">Proposer</dt>
            <dd className="flex items-center gap-2 flex-wrap">
              {proposerHex ? (
                <>
                  <Link href={`/account/${proposerHex}?network=${network}`} className="address-link">
                    {shortenHash(block.header.proposer)}
                  </Link>
                  <CopyButton value={toPrefixedHex64(proposerHex)} label="Copy address" />
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-[var(--text-muted)]">Parent hash</dt>
            <dd className="hash">
              {parentHash ? (
                <Link href={`/block/hash/${parentHash}?network=${network}`} className="text-network-cyan hover:underline">
                  {block.header.parent_hash}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-[var(--text-muted)]">State root</dt>
            <dd className="hash text-[var(--text-secondary)]">{block.header.state_root ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-[var(--text-muted)]">Tx root</dt>
            <dd className="hash text-[var(--text-secondary)]">{block.header.tx_root ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Transactions ({txs.length})
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)] leading-relaxed">
            Each card is one signed transaction executed in this block. Boing does not use an EVM-style
            “transaction hash” for every transfer; execution receipts (gas, return data, logs) appear when
            the node returns them with the block.
          </p>
        </div>
        {!txs.length ? (
          <p className="text-[var(--text-muted)]">No transactions.</p>
        ) : (
          <div className="space-y-5">
            {txs.map((tx, i) => (
              <TransactionInsight
                key={i}
                tx={tx}
                index={i}
                network={network}
                receipt={receiptsWereRequested ? (receipts?.[i] ?? null) : undefined}
                receiptsWereRequested={receiptsWereRequested}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
