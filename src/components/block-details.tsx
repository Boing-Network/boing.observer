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
  consensusHint,
}: {
  block: Block;
  network: string;
  explainerVariant?: "by-hash" | "by-height";
  /** From `boing_getNetworkInfo.consensus` on the same RPC (optional). */
  consensusHint?: { validatorCount: number | null; model?: string };
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
      <section className="glass-card space-y-4 p-4 sm:p-6" aria-labelledby="block-header-heading">
        <h2 id="block-header-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
          Block header
        </h2>
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
          <div className="flex flex-wrap gap-x-2 items-start gap-y-1">
            <dt className="pt-0.5 text-[var(--text-muted)]">Block proposer</dt>
            <dd className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {proposerHex ? (
                  <>
                    <Link
                      href={`/account/${proposerHex}?network=${network}`}
                      className="address-link font-mono text-sm"
                      title="Validator account that proposed this block (HotStuff BFT)"
                    >
                      {shortenHash(block.header.proposer)}
                    </Link>
                    <CopyButton value={toPrefixedHex64(proposerHex)} label="Copy proposer address" />
                  </>
                ) : (
                  "—"
                )}
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                Consensus validators rotate proposal duties; open the account page for balance and contract hints.
              </p>
              {consensusHint &&
                (consensusHint.validatorCount != null || consensusHint.model) && (
                  <p className="text-xs text-[var(--text-muted)]">
                    This node&apos;s validator set size:{" "}
                    <span className="font-mono text-[var(--text-secondary)]">
                      {consensusHint.validatorCount ?? "—"}
                    </span>
                    {consensusHint.model ? (
                      <>
                        {" "}
                        · <span className="font-mono">{consensusHint.model}</span>
                      </>
                    ) : null}
                  </p>
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
      </section>

      <section className="space-y-4" aria-labelledby="block-txs-heading">
        <div>
          <h2 id="block-txs-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Transactions ({txs.length})
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            One card per executed transaction. Receipts (gas, logs, return data) show when the node includes
            them.
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
      </section>
    </>
  );
}
