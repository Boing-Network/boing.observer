"use client";

import Link from "next/link";
import type { BlockTransaction, TransactionReceipt } from "@/lib/rpc-types";
import { hexForLink, shortenHash, toPrefixedHex64 } from "@/lib/rpc-types";
import {
  formatBoingAmount,
  getTxExplorerNarrative,
  getTxPayloadKind,
  getTxPayloadSummary,
} from "@/lib/tx-payload";
import {
  buildPayloadDetailLines,
  hexPreview,
  kindBadgeTone,
  normalizeHexData,
} from "@/lib/tx-details";
import { CopyButton } from "@/components/copy-button";

function TransferFlowDiagram({
  sender,
  payload,
  network,
}: {
  sender: unknown;
  payload: unknown;
  network: string;
}) {
  const p = payload as Record<string, unknown>;
  const from = hexForLink(sender);
  const to = hexForLink(p.to);
  const amount = formatBoingAmount(String(p.amount ?? ""));

  return (
    <div className="rounded-xl border border-network-cyan/25 bg-gradient-to-br from-network-cyan/10 via-boing-navy-mid/40 to-boing-black/30 p-4 sm:p-5">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-network-cyan/90">
        Value flow
      </p>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 rounded-lg border border-[var(--border-color)] bg-boing-black/30 p-3 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">From</p>
          <Link href={`/account/${from}?network=${network}`} className="address-link mt-1 inline-block text-sm">
            {shortenHash(from) || "—"}
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
          <span className="text-2xl leading-none text-network-cyan" aria-hidden>
            ↓
          </span>
          <span className="font-display text-lg font-bold tabular-nums text-[var(--text-primary)]">
            {amount}{" "}
            <span className="text-sm font-semibold text-network-cyan-light">BOING</span>
          </span>
        </div>
        <div className="flex-1 rounded-lg border border-[var(--border-color)] bg-boing-black/30 p-3 text-center sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">To</p>
          <Link href={`/account/${to}?network=${network}`} className="address-link mt-1 inline-block text-sm">
            {shortenHash(to) || "—"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function AccessListPanel({ tx }: { tx: BlockTransaction }) {
  const al = tx.access_list;
  if (!al) return null;
  const reads = al.read?.length ?? 0;
  const writes = al.write?.length ?? 0;
  if (reads === 0 && writes === 0) return null;

  return (
    <details className="rounded-lg border border-[var(--border-color)] bg-boing-black/25">
      <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5">
        Access list (parallel scheduling) · {reads} read · {writes} write
      </summary>
      <div className="space-y-3 border-t border-[var(--border-color)] px-3 py-3 text-xs">
        {reads > 0 ? (
          <div>
            <p className="mb-1 font-medium text-[var(--text-muted)]">Read accounts</p>
            <ul className="hash max-h-32 space-y-1 overflow-y-auto text-[var(--text-secondary)]">
              {al.read!.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {writes > 0 ? (
          <div>
            <p className="mb-1 font-medium text-[var(--text-muted)]">Write accounts</p>
            <ul className="hash max-h-32 space-y-1 overflow-y-auto text-[var(--text-secondary)]">
              {al.write!.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ReceiptPanel({ receipt }: { receipt: TransactionReceipt }) {
  const ok = receipt.success !== false;
  const rd = normalizeHexData(receipt.return_data);
  const txIdRaw = receipt.tx_id ? receipt.tx_id.replace(/^0x/i, "").toLowerCase() : "";

  return (
    <div
      className={`rounded-xl border p-4 ${
        ok
          ? "border-green-500/35 bg-green-950/15"
          : "border-red-500/40 bg-red-950/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-sm font-semibold text-[var(--text-primary)]">Execution</h4>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            ok ? "bg-green-500/20 text-green-200" : "bg-red-500/25 text-red-200"
          }`}
        >
          {ok ? "Success" : "Failed"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        {receipt.gas_used != null ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-[var(--text-muted)]">Gas used</dt>
            <dd className="font-mono text-[var(--text-primary)]">{receipt.gas_used.toLocaleString()}</dd>
          </div>
        ) : null}
        {txIdRaw.length === 64 ? (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-[var(--text-muted)]">Tx id</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="hash text-xs text-[var(--text-secondary)]">{shortenHash(txIdRaw)}</span>
              <CopyButton value={toPrefixedHex64(txIdRaw)} label="Copy tx id" />
            </dd>
          </div>
        ) : null}
        {!ok && receipt.error ? (
          <div>
            <dt className="text-[var(--text-muted)]">Revert / error</dt>
            <dd className="mt-1 rounded-md bg-red-950/40 p-2 text-sm text-red-100">{receipt.error}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[var(--text-muted)]">Return data</dt>
          <dd className="mt-1 space-y-2">
            {rd.bytes === 0 || receipt.return_data === "0x" ? (
              <span className="text-sm text-[var(--text-muted)]">Empty (0x)</span>
            ) : (
              <>
                <p className="hash break-all text-xs text-[var(--text-secondary)]">{hexPreview(rd.prefixed, 72)}</p>
                <CopyButton value={rd.prefixed} label="Copy return data" />
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Event logs ({receipt.logs?.length ?? 0})
        </p>
        {!receipt.logs?.length ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">None for this transaction.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {receipt.logs.map((log, i) => (
              <li
                key={i}
                className="rounded-lg border border-[var(--border-color)] bg-boing-black/40 p-3 text-xs"
              >
                <p className="font-mono text-[var(--text-muted)]">#{i}</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  Topics ({log.topics.length})
                </p>
                <ul className="mt-1 space-y-1 hash break-all text-[var(--text-secondary)]">
                  {log.topics.map((t, j) => (
                    <li key={j}>
                      [{j}] {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[var(--text-muted)]">Data</p>
                <p className="hash mt-0.5 break-all text-[var(--text-secondary)]">
                  {hexPreview(log.data, 80)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function TransactionInsight({
  tx,
  index,
  network,
  receipt,
  receiptsWereRequested,
}: {
  tx: BlockTransaction;
  index: number;
  network: string;
  receipt?: TransactionReceipt | null;
  /** When true but receipt is null, show “not cached” message. */
  receiptsWereRequested: boolean;
}) {
  const kind = getTxPayloadKind(tx.payload);
  const summary = getTxPayloadSummary(tx.payload);
  const narrative = getTxExplorerNarrative(tx.sender, tx.payload);
  const sender = hexForLink(tx.sender);
  const detailLines = buildPayloadDetailLines(tx.payload);

  return (
    <article
      id={`tx-${index}`}
      className="glass-card scroll-mt-24 space-y-4 p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-[var(--text-muted)]">#{index}</span>
            <span
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${kindBadgeTone(kind)}`}
            >
              {kind}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Signer</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Link href={`/account/${sender}?network=${network}`} className="address-link text-sm">
                {shortenHash(sender) || "—"}
              </Link>
              <CopyButton value={toPrefixedHex64(sender)} label="Copy signer" />
            </div>
          </div>
          {tx.nonce !== undefined && tx.nonce !== null ? (
            <p className="text-xs text-[var(--text-muted)]">
              Nonce <span className="font-mono text-[var(--text-secondary)]">{tx.nonce}</span>
            </p>
          ) : null}
        </div>
        <p className="max-w-md text-right text-sm font-medium text-[var(--text-secondary)]">{summary}</p>
      </header>

      {kind === "Transfer" ? (
        <TransferFlowDiagram sender={tx.sender} payload={tx.payload} network={network} />
      ) : null}

      <div className="rounded-lg border border-[var(--border-color)] bg-boing-black/20 p-3 sm:p-4">
        <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          What happened
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{narrative}</p>
      </div>

      {detailLines.length > 0 ? (
        <div>
          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Payload details
          </h4>
          <dl className="mt-2 space-y-3">
            {detailLines.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] sm:w-36">
                  {row.label}
                </dt>
                <dd className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.accountHex64 ? (
                      <Link
                        href={`/account/${row.accountHex64}?network=${network}`}
                        className="hash text-sm text-network-cyan hover:underline"
                      >
                        {row.value}
                      </Link>
                    ) : (
                      <span className="hash break-all text-sm text-[var(--text-primary)]">{row.value}</span>
                    )}
                    {row.copyValue ? <CopyButton value={row.copyValue} label={`Copy ${row.label}`} /> : null}
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <AccessListPanel tx={tx} />

      {receiptsWereRequested ? (
        receipt ? (
          <ReceiptPanel receipt={receipt} />
        ) : (
          <div
            className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 p-3 text-sm text-[var(--text-muted)]"
            role="status"
          >
            No execution receipt is stored for this transaction on this node (older build, pruned data, or
            not yet indexed). Payload above still reflects what was signed.
          </div>
        )
      ) : null}

      <details className="rounded-lg border border-[var(--border-color)] bg-boing-black/30">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5">
          Raw payload (JSON)
        </summary>
        <pre className="max-h-[min(320px,50vh)] overflow-auto border-t border-[var(--border-color)] p-3 text-xs text-[var(--text-secondary)] hash">
          {JSON.stringify(tx.payload, null, 2)}
        </pre>
      </details>
    </article>
  );
}
