"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { explorerAccountHref, explorerAssetHref } from "@/lib/explorer-href";
import { CopyButton } from "@/components/copy-button";
import { toPrefixedHex64 } from "@/lib/rpc-types";
import type { Segment, TxDescription } from "@/lib/tx-decode";

/** Render description segments: amounts bold, tokens / accounts linked to their observer pages. */
export function SegmentsView({ segments, network, copy = false }: { segments: Segment[]; network: string; copy?: boolean }): ReactNode {
  return (
    <>
      {segments.map((s, i) => {
        switch (s.t) {
          case "text":
            return <span key={i}>{s.text}</span>;
          case "amount":
            return (
              <span key={i} className="font-semibold text-[var(--text-primary)]" title={s.title}>
                {s.text}
              </span>
            );
          case "token":
            return (
              <Link key={i} href={explorerAssetHref(s.id, network)} className="font-semibold text-network-cyan hover:underline" title={`0x${s.id}`}>
                {s.text}
              </Link>
            );
          case "account": {
            const asset = s.role === "contract" || !s.text.startsWith("0x");
            return (
              <span key={i} className="inline-flex items-center gap-1">
                <Link
                  href={asset ? explorerAssetHref(s.id, network) : explorerAccountHref(s.id, network)}
                  className={`${s.text.startsWith("0x") ? "hash " : ""}text-network-cyan hover:underline`}
                  title={`0x${s.id}`}
                >
                  {s.text}
                </Link>
                {copy ? <CopyButton value={toPrefixedHex64(s.id)} label="Copy address" /> : null}
              </span>
            );
          }
        }
      })}
    </>
  );
}

/** One-line headline for list rows (links stop propagation so they do not toggle the row). */
export function DecodedHeadline({ description, network }: { description: TxDescription; network: string }) {
  return (
    <span
      className={`text-sm ${description.failed ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}
      data-testid="tx-decoded-headline"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) e.stopPropagation();
      }}
    >
      <SegmentsView segments={description.headline} network={network} />
    </span>
  );
}

/** "What happened" panel for the transaction detail card: headline plus labelled rows. */
export function TxDecodedPanel({ description, network }: { description: TxDescription; network: string }) {
  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        description.failed
          ? "border-red-500/40 bg-red-950/15"
          : "border-emerald-500/35 bg-gradient-to-br from-emerald-950/25 via-boing-navy-mid/40 to-boing-black/30"
      }`}
      data-testid="tx-decoded-panel"
    >
      <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200/90">
        Decoded · {description.title}
      </h4>
      <p className="mt-3 text-base font-medium leading-relaxed text-[var(--text-primary)]">
        <SegmentsView segments={description.headline} network={network} />
      </p>
      <dl className="mt-4 space-y-2.5 border-t border-[var(--border-color)]/60 pt-3">
        {description.rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] sm:w-36">{row.label}</dt>
            <dd className="min-w-0 flex-1 break-words text-sm text-[var(--text-secondary)]">
              <SegmentsView segments={row.value} network={network} copy />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[0.7rem] text-[var(--text-muted)]">
        Decoded from the signed calldata{description.failed ? "" : " and the execution receipt"}; amounts are shown in token units (hover for raw values).
      </p>
    </div>
  );
}
