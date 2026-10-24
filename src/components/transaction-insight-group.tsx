"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { TxInsightGroup } from "@/lib/tx-insight-groups";
import type { TxPayloadKind } from "@/lib/rpc-types";
import {
  explorerAccountHref,
  explorerTxHref,
} from "@/lib/explorer-href";
import { hexForLink, shortenHash, toPrefixedHex64, normalizeHex64 } from "@/lib/rpc-types";
import {
  formatBoingAmount,
  getTxPayloadInner,
  getTxPayloadSummary,
  payloadKindLabel,
} from "@/lib/tx-payload";
import { kindBadgeTone } from "@/lib/tx-details";
import { compactBoingAt } from "@/lib/native-unit";
import { CopyButton } from "@/components/copy-button";
import { TransactionInsight } from "@/components/transaction-insight";
import { TESTNET_FAUCET_ACCOUNT_HEX } from "@/lib/testnet-constants";

function receiptTxId(receipt: { tx_id?: string } | null | undefined): string {
  if (!receipt || typeof receipt.tx_id !== "string") return "";
  return normalizeHex64(receipt.tx_id.replace(/^0x/i, "")) || "";
}

function TransferGroupRows({
  group,
  network,
  blockHeight,
}: {
  group: TxInsightGroup;
  network: string;
  blockHeight?: number | null;
}): ReactNode {
  return (
    <ul className="divide-y divide-[var(--border-color)]/70" data-testid="transfer-group-rows">
      {group.items.map((slot) => {
        const inner = getTxPayloadInner(slot.tx.payload);
        const to = hexForLink(inner.to);
        const amount = compactBoingAt(String(inner.amount ?? ""), blockHeight, network);
        const success = slot.receipt?.success;
        const gas = slot.receipt?.gas_used;
        const txId = receiptTxId(slot.receipt);
        const failed = success === false;
        return (
          <li key={slot.index} id={`tx-${slot.index}`} className="scroll-mt-24 py-3 first:pt-0 last:pb-0">
            <details className="group/row">
              <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-[var(--text-muted)]">#{slot.index}</span>
                  {to ? (
                    <Link
                      href={explorerAccountHref(to, network)}
                      className="hash text-sm text-network-cyan hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortenHash(to) || to}
                    </Link>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">—</span>
                  )}
                  <span
                    className={`text-sm font-semibold ${failed ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}
                    title={`${amount.full} BOING`}
                  >
                    {amount.short} BOING
                  </span>
                  {success === true ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-200">
                      Success
                    </span>
                  ) : null}
                  {failed ? (
                    <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-red-200">
                      Failed
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                  {gas != null ? <span>Gas {Number(gas).toLocaleString()}</span> : null}
                  {txId ? (
                    <Link
                      href={explorerTxHref(txId, network)}
                      className="hash text-network-cyan hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortenHash(txId)}
                    </Link>
                  ) : null}
                  <span className="text-[var(--text-muted)] group-open/row:hidden">Expand</span>
                  <span className="hidden text-[var(--text-muted)] group-open/row:inline">Collapse</span>
                </div>
              </summary>
              <div className="mt-3 border-t border-[var(--border-color)]/50 pt-3">
                <TransactionInsight
                  tx={slot.tx}
                  index={slot.index}
                  network={network}
                  blockHeight={blockHeight ?? undefined}
                  receipt={slot.receipt === undefined ? undefined : slot.receipt}
                  receiptsWereRequested={slot.receipt !== undefined}
                  visualScale="standard"
                  embedded
                />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function GenericGroupRows({
  group,
  network,
  blockHeight,
}: {
  group: TxInsightGroup;
  network: string;
  blockHeight?: number | null;
}): ReactNode {
  return (
    <ul className="divide-y divide-[var(--border-color)]/70" data-testid="payload-group-rows">
      {group.items.map((slot) => {
        const summary = getTxPayloadSummary(slot.tx.payload, blockHeight, network);
        const success = slot.receipt?.success;
        const gas = slot.receipt?.gas_used;
        const txId = receiptTxId(slot.receipt);
        const failed = success === false;
        return (
          <li key={slot.index} id={`tx-${slot.index}`} className="scroll-mt-24 py-3 first:pt-0 last:pb-0">
            <details className="group/row">
              <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-[var(--text-muted)]">#{slot.index}</span>
                  <span className="text-sm text-[var(--text-secondary)]">{summary}</span>
                  {success === true ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-200">
                      Success
                    </span>
                  ) : null}
                  {failed ? (
                    <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-red-200">
                      Failed
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                  {gas != null ? <span>Gas {Number(gas).toLocaleString()}</span> : null}
                  {txId ? (
                    <Link
                      href={explorerTxHref(txId, network)}
                      className="hash text-network-cyan hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortenHash(txId)}
                    </Link>
                  ) : null}
                  <span className="text-[var(--text-muted)] group-open/row:hidden">Expand</span>
                  <span className="hidden text-[var(--text-muted)] group-open/row:inline">Collapse</span>
                </div>
              </summary>
              <div className="mt-3 border-t border-[var(--border-color)]/50 pt-3">
                <TransactionInsight
                  tx={slot.tx}
                  index={slot.index}
                  network={network}
                  blockHeight={blockHeight ?? undefined}
                  receipt={slot.receipt === undefined ? undefined : slot.receipt}
                  receiptsWereRequested={slot.receipt !== undefined}
                  visualScale="standard"
                  embedded
                />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function groupObjectiveLine(kind: TxPayloadKind, count: number, signer: string, network: string): ReactNode {
  const isFaucet = signer === TESTNET_FAUCET_ACCOUNT_HEX.toLowerCase();
  if (kind === "Transfer") {
    return (
      <>
        {count} transfer{count === 1 ? "" : "s"} from{" "}
        {isFaucet ? (
          <Link href={explorerAccountHref(signer, network)} className="text-network-cyan hover:underline">
            testnet faucet
          </Link>
        ) : signer ? (
          <Link href={explorerAccountHref(signer, network)} className="hash text-network-cyan hover:underline">
            {shortenHash(signer) || signer}
          </Link>
        ) : (
          "unknown signer"
        )}
      </>
    );
  }
  return (
    <>
      {count}× {payloadKindLabel(kind).toLowerCase()}
      {signer ? (
        <>
          {" "}
          from{" "}
          <Link href={explorerAccountHref(signer, network)} className="hash text-network-cyan hover:underline">
            {shortenHash(signer) || signer}
          </Link>
        </>
      ) : null}
    </>
  );
}

/**
 * Compact section for consecutive same-kind / same-signer payloads on multi-tx pages.
 * Each row expands to the full `TransactionInsight` card.
 */
export function TransactionInsightGroup({
  group,
  network,
  blockHeight,
  receiptsWereRequested,
}: {
  group: TxInsightGroup;
  network: string;
  blockHeight?: number | null;
  receiptsWereRequested: boolean;
}) {
  const [expandAll, setExpandAll] = useState(false);
  const signer = group.signer;
  const label = payloadKindLabel(group.kind);

  if (group.items.length === 1) {
    const slot = group.items[0]!;
    return (
      <TransactionInsight
        tx={slot.tx}
        index={slot.index}
        network={network}
        blockHeight={blockHeight ?? undefined}
        receipt={slot.receipt === undefined ? undefined : slot.receipt}
        receiptsWereRequested={receiptsWereRequested}
      />
    );
  }

  // When expand-all is on, render full cards (still under one group header).
  if (expandAll) {
    return (
      <article className="glass-card space-y-4 p-4 sm:p-5" data-testid="tx-insight-group">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${kindBadgeTone(group.kind)}`}>
                {label}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{group.items.length} txs</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {groupObjectiveLine(group.kind, group.items.length, signer, network)}
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-network-cyan hover:underline"
            onClick={() => setExpandAll(false)}
          >
            Collapse to list
          </button>
        </header>
        <div className="space-y-4">
          {group.items.map((slot) => (
            <TransactionInsight
              key={slot.index}
              tx={slot.tx}
              index={slot.index}
              network={network}
              blockHeight={blockHeight ?? undefined}
              receipt={slot.receipt === undefined ? undefined : slot.receipt}
              receiptsWereRequested={receiptsWereRequested}
            />
          ))}
        </div>
      </article>
    );
  }

  const totalBoing =
    group.kind === "Transfer"
      ? group.items.reduce((acc, slot) => {
          const amt = String(getTxPayloadInner(slot.tx.payload).amount ?? "0");
          try {
            return acc + BigInt(/^\d+$/.test(amt) ? amt : "0");
          } catch {
            return acc;
          }
        }, BigInt(0))
      : null;

  return (
    <article className="glass-card space-y-4 p-4 sm:p-5" data-testid="tx-insight-group">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${kindBadgeTone(group.kind)}`}>
              {label}
            </span>
            <span className="text-xs text-[var(--text-muted)]">{group.items.length} txs</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Signer</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {signer ? (
                <>
                  <Link href={explorerAccountHref(signer, network)} className="address-link text-sm">
                    {shortenHash(signer) || "—"}
                  </Link>
                  <CopyButton value={toPrefixedHex64(signer)} label="Copy signer" />
                </>
              ) : (
                <span className="text-sm text-[var(--text-muted)]">—</span>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {groupObjectiveLine(group.kind, group.items.length, signer, network)}
            {totalBoing != null && totalBoing > BigInt(0) ? (
              <>
                {" "}
                · total{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {formatBoingAmount(totalBoing.toString(), blockHeight, network)} BOING
                </span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-network-cyan hover:underline"
          onClick={() => setExpandAll(true)}
        >
          Expand all
        </button>
      </header>

      {group.kind === "Transfer" ? (
        <TransferGroupRows group={group} network={network} blockHeight={blockHeight} />
      ) : (
        <GenericGroupRows group={group} network={network} blockHeight={blockHeight} />
      )}
    </article>
  );
}
