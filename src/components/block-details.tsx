"use client";

import Link from "next/link";
import type { Block, BlockTransaction } from "@/lib/rpc-types";
import { shortenHash, hexForLink, toPrefixedHex64 } from "@/lib/rpc-types";
import { getTxPayloadKind, getTxPayloadSummary, getTxExplorerNarrative } from "@/lib/tx-payload";
import { CopyButton } from "@/components/copy-button";
import { BlockExplainerBanner } from "@/components/block-explainer";

function TxRow({ tx, index, network }: { tx: BlockTransaction; index: number; network: string }) {
  const kind = getTxPayloadKind(tx.payload);
  const summary = getTxPayloadSummary(tx.payload);
  const narrative = getTxExplorerNarrative(tx.sender, tx.payload);
  const sender = hexForLink(tx.sender);

  return (
    <tr className="border-b border-[var(--border-color)]/60 hover:bg-white/5 align-top">
      <td className="py-2 pr-4 font-mono text-sm text-[var(--text-muted)]">{index}</td>
      <td className="py-2 pr-4">
        <span className="rounded bg-boing-navy-mid px-2 py-0.5 text-xs font-medium text-network-cyan">
          {kind}
        </span>
      </td>
      <td className="py-2 pr-4">
        <Link href={`/account/${sender}?network=${network}`} className="address-link">
          {shortenHash(sender || "0")}
        </Link>
      </td>
      <td className="py-2 pr-4 text-sm text-[var(--text-secondary)]">{summary}</td>
      <td className="py-2 text-sm text-[var(--text-muted)] max-w-md">{narrative}</td>
    </tr>
  );
}

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

  return (
    <>
      {explainerVariant ? <BlockExplainerBanner variant={explainerVariant} /> : null}
      <div className="glass-card p-6 space-y-4">
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
              ) : "—"}
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

      <div className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-4">
          Transactions ({block.transactions?.length ?? 0})
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Each row is one signed transaction executed atomically with this block. Effects (e.g. faucet
          credit) are final once the block is committed.
        </p>
        {!block.transactions?.length ? (
          <p className="text-[var(--text-muted)]">No transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-sm text-[var(--text-muted)]">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Sender</th>
                  <th className="pb-2 pr-4">Summary</th>
                  <th className="pb-2">What happened</th>
                </tr>
              </thead>
              <tbody>
                {block.transactions.map((tx, i) => (
                  <TxRow key={i} tx={tx} index={i} network={network} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
