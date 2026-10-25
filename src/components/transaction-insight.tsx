"use client";

import { failedTxFeeBaseUnits } from "@/lib/failed-tx";
import { compactBoingAt, formatBoingBase } from "@/lib/native-unit";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { BlockTransaction, TransactionReceipt } from "@/lib/rpc-types";
import { hexForLink, shortenHash, toPrefixedHex64, normalizeHex64 } from "@/lib/rpc-types";
import { explorerAccountHref, explorerAssetHref, explorerBlockHeightHref, explorerNftItemHref, explorerTxHref } from "@/lib/explorer-href";
import { tryParseCreatedAccountIdFromDeployReturnData } from "@/lib/deploy-receipt";
import {
  decodeReferenceNftCalldata,
  REF_NFT_SELECTOR_MINT_BATCH,
  REF_NFT_SELECTOR_TRANSFER_NFT,
  tryReferenceNftTokenIdU64,
} from "@/lib/reference-nft-calldata";
import {
  getTxExplorerNarrative,
  getTxPayloadInner,
  getTxPayloadKind,
  getTxPayloadSummary,
  isContractDeployPayloadKind,
  batchCallValueTotal,
  batchSteps,
  contractCallValue,
  payloadKindLabel,
} from "@/lib/tx-payload";
import {
  buildPayloadDetailLines,
  hexPreview,
  kindBadgeTone,
  normalizeHexData,
} from "@/lib/tx-details";
import { CopyButton } from "@/components/copy-button";
import { TESTNET_FAUCET_ACCOUNT_HEX } from "@/lib/testnet-constants";
import type { TxPayloadKind } from "@/lib/rpc-types";
import { formatPurposeLabel, isNftPurposeOrKind } from "@/lib/asset-kind-label";
import { formatAssetDisplayLabel, parseAssetDisplayMetadata } from "@/lib/extract-media-url";
import { AssetMediaThumb } from "@/components/asset-media-thumb";
import { BlobDownloadPanel } from "@/components/blob-download-panel";
import { extractPutBlobDownloadHint } from "@/lib/blob-download";
import { nameHref } from "@/lib/boing-names";

function formatBoingName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) return "—";
  return s.endsWith(".boing") ? s : `${s}.boing`;
}

type VisualScale = "standard" | "featured";

function formatPurposeHeadline(cat: string): string {
  return formatPurposeLabel(cat);
}

function SignedPayloadHeadlineRich({
  kind,
  inner,
  network,
  failed = false,
  height,
}: {
  kind: TxPayloadKind;
  inner: Record<string, unknown>;
  network: string;
  /** Receipt says the tx reverted: phrase it as attempted, nothing moved. */
  failed?: boolean;
  /** Block height of the tx (native amount unit; see `native-unit.ts`). */
  height?: number | null;
}): ReactNode {
  const amt = (k: string) => {
    const c = compactBoingAt(String(inner[k] ?? "0"), height, network);
    return (
      <span title={`${c.full} BOING`} className={failed ? "text-[var(--text-muted)] line-through" : undefined}>
        {c.short}
      </span>
    );
  };
  const reverted = failed ? (
    <span className="font-semibold text-red-300" data-testid="signed-reverted">
      {" "}
      It was attempted but reverted: no BOING moved, only the fee was charged.
    </span>
  ) : null;
  switch (kind) {
    case "Bond":
      return (
        <>
          {failed ? "You signed (attempted) a bond (stake) of " : "You signed a bond (stake) of "}
          {amt("amount")} BOING
          {failed ? "." : " — it moves from liquid balance into validator stake when executed."}
          {reverted}
        </>
      );
    case "Unbond":
      return (
        <>
          {failed ? "You signed (attempted) an unbond of " : "You signed an unbond of "}
          {amt("amount")} BOING
          {failed ? "." : " — stake begins leaving per protocol rules when executed."}
          {reverted}
        </>
      );
    case "Transfer": {
      const to = hexForLink(inner.to);
      const short = to ? shortenHash(to) || to : "—";
      return (
        <>
          {failed ? "You attempted a transfer of " : "You signed a transfer of "}
          {amt("amount")} BOING to{" "}
          {to ? (
            <Link href={explorerAccountHref(to, network)} className="text-network-cyan hover:underline">
              {short}
            </Link>
          ) : (
            "—"
          )}
          .{reverted}
        </>
      );
    }
    case "ContractCall": {
      const c = hexForLink(inner.contract);
      const short = c ? shortenHash(c) || c : "—";
      return (
        <>
          You signed a call to contract{" "}
          {c ? (
            <Link href={explorerAssetHref(c, network)} className="text-network-cyan hover:underline">
              {short}
            </Link>
          ) : (
            "—"
          )}
          {inner.calldata ? " with calldata" : ""}
          {contractCallValue(inner) ? (
            <>
              {failed ? ", attempting to send " : ", sending "}
              <span data-testid="signed-call-value">{amt("value")} BOING</span> to it
            </>
          ) : null}
          .{contractCallValue(inner) ? reverted : null}
        </>
      );
    }
    case "Batch": {
      const steps = batchSteps(inner);
      const total = batchCallValueTotal(steps);
      const c = total ? compactBoingAt(total, height, network) : null;
      return (
        <>
          {failed ? "You attempted a batch of " : "You signed a batch of "}
          {steps.length} step{steps.length === 1 ? "" : "s"} (all succeed or all revert)
          {c ? (
            <>
              {failed ? ", attempting to send " : ", sending "}
              <span title={`${c.full} BOING`} data-testid="signed-call-value">
                {c.short} BOING
              </span>{" "}
              to contracts
            </>
          ) : null}
          .{reverted}
        </>
      );
    }
    case "ContractDeploy":
      return <>You signed a contract deployment (bytecode in payload).</>;
    case "ContractDeployWithPurpose":
      return (
        <>
          You signed a contract deployment with purpose{" "}
          {formatPurposeHeadline(String(inner.purpose_category ?? "other"))}.
        </>
      );
    case "ContractDeployWithPurposeAndMetadata": {
      const parsed = parseAssetDisplayMetadata(
        typeof inner.asset_name === "string" ? inner.asset_name : null,
        typeof inner.asset_symbol === "string" ? inner.asset_symbol : null,
      );
      const meta = formatAssetDisplayLabel(parsed, "");
      return (
        <>
          You signed a deployment ({formatPurposeHeadline(String(inner.purpose_category ?? "other"))}
          {meta ? ` · ${meta}` : ""}).
        </>
      );
    }
    case "ClaimUnbond":
      return (
        <>
          You signed a <span className="font-mono">claim_unbond</span> — Boing-native stake claim (not an EVM withdrawal). Pending unbond returns to liquid balance when the unlock height is reached.
        </>
      );
    case "QaPoolVote": {
      const subj = hexForLink(inner.subject ?? inner.subject_hex);
      const short = subj ? shortenHash(subj) || subj : "—";
      return (
        <>
          You signed a QA pool vote ({String(inner.vote ?? "")}) on subject{" "}
          {subj ? (
            <Link href={explorerTxHref(subj, network)} className="text-network-cyan hover:underline">
              {short}
            </Link>
          ) : (
            "—"
          )}
          .
        </>
      );
    }
    case "NameCommit":
      return <>You signed a name-registry commit (commitment hash; label reveals on register).</>;
    case "NameRegister": {
      const label = String(inner.name ?? "").trim().replace(/\.boing$/i, "");
      const display = formatBoingName(inner.name);
      const target = hexForLink(inner.target);
      return (
        <>
          You signed a name claim for{" "}
          {label ? (
            <Link href={nameHref(label, network)} className="text-network-cyan hover:underline">
              {display}
            </Link>
          ) : (
            display
          )}{" "}
          for {String(inner.years ?? "—")} year(s), resolving to{" "}
          {target ? (
            <Link href={explorerAccountHref(target, network)} className="text-network-cyan hover:underline">
              {shortenHash(target) || target}
            </Link>
          ) : (
            "—"
          )}
          .
        </>
      );
    }
    case "NameRenew":
      return (
        <>
          You signed a renew of {formatBoingName(inner.name)} for {String(inner.years ?? "—")} year(s).
        </>
      );
    case "NameTransfer": {
      const owner = hexForLink(inner.new_owner);
      return (
        <>
          You signed a transfer of {formatBoingName(inner.name)} to{" "}
          {owner ? (
            <Link href={explorerAccountHref(owner, network)} className="text-network-cyan hover:underline">
              {shortenHash(owner) || owner}
            </Link>
          ) : (
            "—"
          )}
          .
        </>
      );
    }
    case "NameSetTarget": {
      const target = hexForLink(inner.target);
      return (
        <>
          You signed a retarget of {formatBoingName(inner.name)} to{" "}
          {target ? (
            <Link href={explorerAccountHref(target, network)} className="text-network-cyan hover:underline">
              {shortenHash(target) || target}
            </Link>
          ) : (
            "—"
          )}
          .
        </>
      );
    }
    case "NameSetPrimary":
      return (
        <>
          You signed{" "}
          {inner.name == null || inner.name === ""
            ? "clearing your primary .boing name"
            : `setting primary name to ${formatBoingName(inner.name)}`}
          .
        </>
      );
    case "NameRelease":
      return <>You signed releasing {formatBoingName(inner.name)} (no refund).</>;
    case "ValidatorRegister":
    case "ValidatorDeregister":
    case "ValidatorUnjail":
    case "PutBlob": {
      const data = inner.data;
      const size =
        data && typeof data === "object" && !Array.isArray(data) && "size" in data
          ? Number((data as { size?: unknown }).size)
          : typeof data === "string" && data.startsWith("0x")
            ? Math.max(0, Math.floor((data.length - 2) / 2))
            : Array.isArray(data)
              ? data.length
              : null;
      return (
        <>
          You signed a media blob publish
          {size != null && Number.isFinite(size) ? ` (${size.toLocaleString()} bytes)` : ""}.
          {data && typeof data === "object" && (data as { omitted?: unknown }).omitted
            ? " Raw bytes are omitted in this explorer view."
            : null}
        </>
      );
    }
    case "BlobAnnounce":
    case "RenewMediaBlobPin":
    case "PayBlobSample":
    case "RegisterBlobSampleOffer":
    case "SettleBlobSampleMatch":
    case "CancelBlobSampleOffer":
    case "ChallengeBlobSampleServe":
    case "RespondBlobSampleServe":
    case "GrantBlobDownload":
    case "RevokeBlobDownload":
    case "SubmitSlashAppeal":
    case "ResolveSlashAppeal":
    case "ResolveSlashAppealAttested":
    case "ResolveSlashAppealBlsAggregate":
      return <>You signed a {payloadKindLabel(kind).toLowerCase()}.</>;
    case "Unknown":
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function TxContextNarrativeRich({
  kind,
  sender,
  payload,
  network,
  height,
}: {
  kind: TxPayloadKind;
  sender: unknown;
  payload: unknown;
  network: string;
  height?: number | null;
}): ReactNode {
  const from = hexForLink(sender);
  const p = getTxPayloadInner(payload);

  switch (kind) {
    case "Unknown":
      return <>Payload shape not recognized by this explorer.</>;
    case "ContractDeploy":
    case "ContractDeployWithPurpose":
    case "ContractDeployWithPurposeAndMetadata":
      return (
        <>
          Contract deploy ·{" "}
          {from ? (
            <Link href={explorerAccountHref(from, network)} className="text-network-cyan hover:underline">
              {shortenHash(from) || from}
            </Link>
          ) : (
            "—"
          )}{" "}
          (QA may apply)
        </>
      );
    case "Transfer": {
      const faucet = TESTNET_FAUCET_ACCOUNT_HEX.toLowerCase();
      if (from !== faucet) {
        return <>{getTxExplorerNarrative(sender, payload, height, network)}</>;
      }
      const amount = compactBoingAt(String(p.amount ?? ""), height, network).short;
      const to = hexForLink(p.to);
      return (
        <>
          Testnet{" "}
          <Link href={explorerAccountHref(faucet, network)} className="text-network-cyan hover:underline">
            faucet
          </Link>
          {" → "}
          {to ? (
            <Link href={explorerAccountHref(to, network)} className="text-network-cyan hover:underline">
              {shortenHash(to) || to}
            </Link>
          ) : (
            "—"
          )}
          {" · "}
          {amount} BOING
        </>
      );
    }
    default:
      return <>{getTxExplorerNarrative(sender, payload, height, network)}</>;
  }
}

function LogTopicLine({ topic, network }: { topic: string; network: string }) {
  const inner = topic.replace(/^0x/i, "");
  if (inner.length === 64 && /^[0-9a-fA-F]+$/.test(inner)) {
    const h = normalizeHex64(inner);
    if (h) {
      return (
        <Link href={explorerAssetHref(h, network)} className="text-network-cyan hover:underline break-all">
          {topic}
        </Link>
      );
    }
  }
  return <span className="break-all">{topic}</span>;
}

function TransferFlowDiagram({
  sender,
  payload,
  network,
  scale = "standard",
  failed = false,
  feeBoing = null,
  height,
}: {
  sender: unknown;
  payload: unknown;
  network: string;
  scale?: VisualScale;
  /** Receipt says the tx reverted: nothing was transferred (only the fee was charged). */
  failed?: boolean;
  /** Fee as a formatted BOING string. */
  feeBoing?: string | null;
  height?: number | null;
}) {
  const p = payload as Record<string, unknown>;
  const from = hexForLink(sender);
  const to = hexForLink(p.to);
  const amt = compactBoingAt(String(p.amount ?? ""), height, network);
  const amount = amt.short;
  const amountTitle = `${amt.full} BOING`;
  const featured = scale === "featured";
  const amountTone = failed ? "text-[var(--text-muted)] line-through decoration-red-400/80" : "text-[var(--text-primary)]";
  const failedNote = failed ? (
    <p className="mt-2 text-xs text-red-200" data-testid="flow-failed-fee">
      Reverted: no balance changed except the sender&apos;s fee
      {feeBoing != null ? ` (${feeBoing} BOING)` : ""}.
    </p>
  ) : null;

  return (
    <div
      data-testid="transfer-flow"
      className={`min-w-0 overflow-hidden rounded-xl border ${failed ? "border-red-500/35" : "border-network-cyan/25"} bg-gradient-to-br from-network-cyan/10 via-boing-navy-mid/40 to-boing-black/30 ${
        featured ? "p-5 sm:p-8" : "p-4 sm:p-5"
      }`}
    >
      {featured ? (
        <div className="mb-6 rounded-lg border border-network-cyan/30 bg-boing-black/40 px-4 py-6 text-center sm:px-8">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${failed ? "text-red-300" : "text-network-cyan/90"}`}
          >
            {failed ? "Not transferred (failed)" : "Amount transferred"}
          </p>
          <p
            title={amountTitle}
            className={`mt-3 truncate font-display text-4xl font-bold tabular-nums tracking-tight sm:text-5xl ${amountTone}`}
          >
            {amount}
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-network-cyan-light">BOING</p>
          {failed ? (
            failedNote
          ) : (
            <p className="mt-2 text-xs text-[var(--text-muted)]">Applied when this block executed.</p>
          )}
        </div>
      ) : null}
      <p
        className={`mb-3 text-center font-semibold uppercase tracking-wider text-network-cyan/90 ${
          featured ? "text-sm" : "text-xs"
        }`}
      >
        {featured ? "Parties" : failed ? "Value flow: not transferred (failed)" : "Value flow"}
      </p>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        <div className="flex-1 rounded-lg border border-[var(--border-color)] bg-boing-black/30 p-3 text-center sm:p-4 sm:text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {featured ? (failed ? "Sender (fee only)" : "Sender (debited)") : "From"}
          </p>
          <Link
            href={explorerAccountHref(from, network)}
            className={`address-link mt-1 inline-block ${featured ? "text-base font-semibold" : "text-sm"}`}
          >
            {shortenHash(from) || "—"}
          </Link>
          {featured && from ? (
            <p className="mt-2 hash break-all text-left text-[0.65rem] leading-snug text-[var(--text-muted)]">
              <Link href={explorerAccountHref(from, network)} className="text-network-cyan hover:underline">
                0x{from}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-2 text-center">
          {featured ? (
            <span className="text-4xl leading-none text-network-cyan sm:text-5xl" aria-hidden>
              →
            </span>
          ) : (
            <>
              <span className="text-2xl leading-none text-network-cyan" aria-hidden>
                ↓
              </span>
              <span
                title={amountTitle}
                className={`max-w-full truncate font-display text-lg font-bold tabular-nums ${amountTone}`}
              >
                {amount}{" "}
                <span className="text-sm font-semibold text-network-cyan-light">BOING</span>
              </span>
              {failedNote}
            </>
          )}
        </div>
        <div className="flex-1 rounded-lg border border-[var(--border-color)] bg-boing-black/30 p-3 text-center sm:p-4 sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {featured ? (failed ? "Recipient (not credited)" : "Recipient (credited)") : "To"}
          </p>
          <Link
            href={explorerAccountHref(to, network)}
            className={`address-link mt-1 inline-block ${featured ? "text-base font-semibold" : "text-sm"}`}
          >
            {shortenHash(to) || "—"}
          </Link>
          {featured && to ? (
            <p className="mt-2 hash break-all text-right text-[0.65rem] leading-snug text-[var(--text-muted)] sm:text-right">
              <Link href={explorerAccountHref(to, network)} className="text-network-cyan hover:underline">
                0x{to}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StakeMovementVisual({
  kind,
  sender,
  payload,
  network,
  failed = false,
  feeBoing = null,
  height,
}: {
  kind: "Bond" | "Unbond";
  sender: unknown;
  payload: unknown;
  network: string;
  failed?: boolean;
  feeBoing?: string | null;
  height?: number | null;
}) {
  const p = payload as Record<string, unknown>;
  const from = hexForLink(sender);
  const amt = compactBoingAt(String(p.amount ?? ""), height, network);
  const amount = amt.short;
  const title = failed
    ? kind === "Bond"
      ? "Not staked (failed)"
      : "Not unbonded (failed)"
    : kind === "Bond"
      ? "Staked (bonded)"
      : "Unbond requested";
  const subtitle = failed
    ? `Reverted: stake and balance unchanged except the fee${feeBoing != null ? ` (${feeBoing} BOING)` : ""}.`
    : kind === "Bond"
      ? "Added to validator stake."
      : "Scheduled to unbond per protocol.";

  return (
    <div className="rounded-xl border border-network-primary/35 bg-gradient-to-br from-network-primary/15 via-boing-navy-mid/50 to-boing-black/40 p-5 sm:p-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-network-primary-light/90">
          {title}
        </p>
        <p
          title={`${amt.full} BOING`}
          className={`mt-3 truncate font-display text-4xl font-bold tabular-nums sm:text-5xl ${
            failed ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"
          }`}
        >
          {amount}
        </p>
        <p className="mt-1 font-display text-xl font-semibold text-network-primary-light">BOING</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>
      <div className="mt-6 rounded-lg border border-[var(--border-color)] bg-boing-black/35 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Signer account</p>
        <Link href={explorerAccountHref(from, network)} className="address-link mt-2 inline-block text-base font-semibold">
          {shortenHash(from) || "—"}
        </Link>
        {from ? (
          <p className="mt-2 hash break-all text-center text-[0.65rem] leading-snug text-[var(--text-muted)]">
            <Link href={explorerAccountHref(from, network)} className="text-network-cyan hover:underline">
              0x{from}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContractCallFeaturedVisual({ payload, network }: { payload: unknown; network: string }) {
  const p = payload as Record<string, unknown>;
  const contract = hexForLink(p.contract);
  const cd = normalizeHexData(p.calldata);
  const decoded =
    typeof p.calldata === "string" ? decodeReferenceNftCalldata(p.calldata) : null;
  const nftTokenIds =
    decoded?.selector === REF_NFT_SELECTOR_MINT_BATCH
      ? decoded.tokenIds
      : decoded?.selector === REF_NFT_SELECTOR_TRANSFER_NFT
        ? [decoded.tokenId]
        : [];
  const nftOpLabel =
    decoded?.selector === REF_NFT_SELECTOR_MINT_BATCH
      ? `mint_batch · ${decoded.n} token${decoded.n === 1 ? "" : "s"}`
      : decoded?.selector === REF_NFT_SELECTOR_TRANSFER_NFT
        ? "transfer_nft / mint"
        : null;

  return (
    <div className="rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-boing-navy-mid/50 to-boing-black/40 p-5 sm:p-8">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/90">
        Contract interaction
      </p>
      <p className="mt-1 text-center text-xs text-[var(--text-secondary)]">
        Native transfer only if the contract sends one; see receipt and logs.
      </p>
      <div className="mt-6 rounded-lg border border-[var(--border-color)] bg-boing-black/35 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Contract account</p>
        <Link
          href={explorerAssetHref(contract, network)}
          className="mt-2 inline-block font-display text-lg font-semibold text-amber-100 hover:text-amber-50"
        >
          {shortenHash(contract) || "—"}
        </Link>
        {contract ? (
          <p className="mt-2 hash break-all text-center text-[0.65rem] text-[var(--text-muted)]">
            <Link href={explorerAssetHref(contract, network)} className="text-network-cyan hover:underline">
              0x{contract}
            </Link>
          </p>
        ) : null}
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          Calldata: <span className="font-mono text-network-cyan">{cd.bytes}</span> bytes
          {nftOpLabel ? (
            <>
              {" "}
              · <span className="text-amber-100/90">{nftOpLabel}</span>
            </>
          ) : null}
        </p>
        {contract && nftTokenIds.length > 0 ? (
          <div className="mt-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Minted / transferred NFTs
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {nftTokenIds.slice(0, 32).map((id) => {
                const id64 = normalizeHex64(id.replace(/^0x/i, ""));
                if (!id64) return null;
                const u64 = tryReferenceNftTokenIdU64(id);
                const label = u64 != null ? `#${u64}` : shortenHash(id64, 8, 6);
                return (
                  <li key={id64}>
                    <Link
                      href={explorerNftItemHref(contract, id64, network)}
                      className="font-mono text-network-cyan hover:underline"
                    >
                      NFT {label}
                    </Link>
                  </li>
                );
              })}
              {nftTokenIds.length > 32 ? (
                <li className="text-[var(--text-muted)]">…and {nftTokenIds.length - 32} more</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AccessListPanel({ tx, network }: { tx: BlockTransaction; network: string }) {
  const al = tx.access_list;
  if (!al) return null;
  const reads = al.read?.length ?? 0;
  const writes = al.write?.length ?? 0;
  if (reads === 0 && writes === 0) return null;

  return (
    <details className="rounded-lg border border-[var(--border-color)] bg-boing-black/25">
      <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5">
        Access list · {reads} read · {writes} write
      </summary>
      <div className="space-y-3 border-t border-[var(--border-color)] px-3 py-3 text-xs">
        {reads > 0 ? (
          <div>
            <p className="mb-1 font-medium text-[var(--text-muted)]">Read accounts</p>
            <ul className="hash max-h-32 space-y-1 overflow-y-auto text-[var(--text-secondary)]">
              {al.read!.map((h) => {
                const link = hexForLink(h);
                return (
                  <li key={h}>
                    {link ? (
                      <Link href={explorerAssetHref(link, network)} className="text-network-cyan hover:underline">
                        {h}
                      </Link>
                    ) : (
                      h
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {writes > 0 ? (
          <div>
            <p className="mb-1 font-medium text-[var(--text-muted)]">Write accounts</p>
            <ul className="hash max-h-32 space-y-1 overflow-y-auto text-[var(--text-secondary)]">
              {al.write!.map((h) => {
                const link = hexForLink(h);
                return (
                  <li key={h}>
                    {link ? (
                      <Link href={explorerAssetHref(link, network)} className="text-network-cyan hover:underline">
                        {h}
                      </Link>
                    ) : (
                      h
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ReceiptPanel({
  receipt,
  network,
  showTransactionPageLink,
  height,
}: {
  receipt: TransactionReceipt;
  network: string;
  showTransactionPageLink: boolean;
  height?: number | null;
}) {
  const failedFee = failedTxFeeBaseUnits(receipt, height ?? receipt.block_height, network);
  const ok = receipt.success !== false;
  const rd = normalizeHexData(receipt.return_data);
  const txIdRaw = receipt.tx_id ? normalizeHex64(receipt.tx_id) : "";
  const txPageHref =
    txIdRaw.length === 64 ? explorerTxHref(txIdRaw, network) : "";

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
              <Link href={txPageHref || explorerTxHref(txIdRaw, network)} className="hash text-xs text-network-cyan hover:underline">
                {shortenHash(txIdRaw)}
              </Link>
              <CopyButton value={toPrefixedHex64(txIdRaw)} label="Copy tx id" />
              {showTransactionPageLink && txPageHref ? (
                <Link
                  href={txPageHref}
                  className="text-xs font-semibold text-network-cyan hover:text-network-cyan-light hover:underline"
                >
                  Transaction page
                </Link>
              ) : null}
            </dd>
          </div>
        ) : null}
        {!ok && receipt.gas_used ? (
          <div className="flex flex-wrap gap-x-2" data-testid="failed-tx-fee">
            <dt className="text-[var(--text-muted)]">Fee charged</dt>
            <dd className="text-[var(--text-primary)]">
              {failedFee != null ? formatBoingBase(failedFee) : "?"} BOING (failed transactions still pay a fee; state was reverted)
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

      <details className="mt-3 rounded-lg border border-[var(--border-color)] bg-boing-black/25">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5">
          Event logs ({receipt.logs?.length ?? 0})
        </summary>
        <div className="border-t border-[var(--border-color)] px-3 py-3">
          {!receipt.logs?.length ? (
            <p className="text-xs text-[var(--text-muted)]">None.</p>
          ) : (
            <ul className="space-y-2">
              {receipt.logs.map((log, i) => (
                <li
                  key={i}
                  className="rounded-md border border-[var(--border-color)]/80 bg-boing-black/40 p-2.5 text-xs"
                >
                  <p className="font-mono text-[var(--text-muted)]">#{i}</p>
                  <ul className="mt-1 space-y-0.5 hash break-all text-[var(--text-secondary)]">
                    {log.topics.map((t, j) => (
                      <li key={j}>
                        t{j} <LogTopicLine topic={t} network={network} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 hash break-all text-[var(--text-secondary)]">{hexPreview(log.data, 64)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}

export function TransactionInsight({
  tx,
  index,
  network,
  receipt,
  receiptsWereRequested,
  visualScale = "standard",
  blockPlacement,
  blockHeight,
  embedded = false,
}: {
  tx: BlockTransaction;
  index: number;
  network: string;
  receipt?: TransactionReceipt | null;
  /** When true but receipt is null, show “not cached” message. */
  receiptsWereRequested: boolean;
  visualScale?: VisualScale;
  /** When set (e.g. standalone tx page), links to the enclosing block and anchor. */
  blockPlacement?: { height: number; txIndex: number };
  /** Height of the enclosing block when rendered inside a block page (native amount unit). */
  blockHeight?: number;
  /** Nested under a group row: skip outer glass card + anchor id (parent owns `#tx-N`). */
  embedded?: boolean;
}) {
  const txHeight = blockPlacement?.height ?? blockHeight ?? receipt?.block_height ?? null;
  const kind = getTxPayloadKind(tx.payload);
  const summary = getTxPayloadSummary(tx.payload, txHeight, network);
  const sender = hexForLink(tx.sender);
  const payloadInner = getTxPayloadInner(tx.payload);
  const detailLines = buildPayloadDetailLines(tx.payload, txHeight, network);
  const txFailed = receipt?.success === false;
  const txFeeBase = failedTxFeeBaseUnits(receipt, txHeight, network);
  const txFeeBoing = txFeeBase != null ? formatBoingBase(txFeeBase) : null;
  const deployedAssetHex =
    isContractDeployPayloadKind(kind) && receipt && receipt.success !== false
      ? tryParseCreatedAccountIdFromDeployReturnData(receipt.return_data)
      : null;
  const deployDisplay = parseAssetDisplayMetadata(
    typeof payloadInner.asset_name === "string" ? payloadInner.asset_name : null,
    typeof payloadInner.asset_symbol === "string" ? payloadInner.asset_symbol : null,
  );
  const [offchainImage, setOffchainImage] = useState<string | null>(null);
  const [nftSampleImage, setNftSampleImage] = useState<string | null>(null);
  const purposeCategory =
    typeof payloadInner.purpose_category === "string" ? payloadInner.purpose_category : "";
  const deployKindHint = isNftPurposeOrKind(purposeCategory) ? "nft" : purposeCategory || null;

  useEffect(() => {
    if (deployDisplay.imageUrl) {
      setOffchainImage(null);
      return;
    }
    const hash = payloadInner.description_hash;
    if (hash == null) {
      setOffchainImage(null);
      return;
    }
    let cancelled = false;
    const hex =
      typeof hash === "string"
        ? hash.replace(/^0x/i, "")
        : Array.isArray(hash)
          ? (hash as number[]).map((n) => n.toString(16).padStart(2, "0")).join("")
          : "";
    if (hex.length !== 64) {
      setOffchainImage(null);
      return;
    }
    void fetch(`/api/asset/metadata?hash=${encodeURIComponent(hex)}`)
      .then(async (res) => (await res.json()) as { found?: boolean; imageUrl?: string | null })
      .then((json) => {
        if (!cancelled && json.found && json.imageUrl) setOffchainImage(json.imageUrl);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [deployDisplay.imageUrl, payloadInner.description_hash]);

  useEffect(() => {
    if (!deployedAssetHex || !isNftPurposeOrKind(purposeCategory)) {
      setNftSampleImage(null);
      return;
    }
    if (deployDisplay.imageUrl || offchainImage) {
      setNftSampleImage(null);
      return;
    }
    let cancelled = false;
    const id = encodeURIComponent(toPrefixedHex64(deployedAssetHex));
    void fetch(
      `/api/asset/profile?network=${encodeURIComponent(network)}&id=${id}&scan=0&nftProbe=1`,
      { headers: { Accept: "application/json" } },
    )
      .then(async (res) => (await res.json()) as { imageUrl?: string | null; nftSamples?: Array<{ imageUrl?: string | null }> })
      .then((json) => {
        if (cancelled) return;
        const fromSamples = json.nftSamples?.find((s) => s.imageUrl)?.imageUrl ?? null;
        setNftSampleImage(json.imageUrl || fromSamples || null);
      })
      .catch(() => {
        if (!cancelled) setNftSampleImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [deployedAssetHex, purposeCategory, deployDisplay.imageUrl, offchainImage, network]);

  const deployImageUrl = deployDisplay.imageUrl || offchainImage || nftSampleImage;
  const deployLabel = formatAssetDisplayLabel(deployDisplay, "");
  const featured = visualScale === "featured";
  const blobDownloadHint =
    kind === "PutBlob" || kind === "BlobAnnounce"
      ? extractPutBlobDownloadHint(payloadInner)
      : null;

  const isFaucetTransfer =
    kind === "Transfer" && sender === TESTNET_FAUCET_ACCOUNT_HEX.toLowerCase();
  const showContextNote = kind === "Unknown" || isContractDeployPayloadKind(kind) || isFaucetTransfer;

  return (
    <article
      id={embedded ? undefined : `tx-${index}`}
      className={
        embedded
          ? "space-y-4 rounded-lg border border-[var(--border-color)]/60 bg-boing-black/20 p-3 sm:p-4"
          : "glass-card scroll-mt-24 space-y-4 p-4 sm:p-5"
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {blockPlacement ? (
              <Link
                href={explorerBlockHeightHref(blockPlacement.height, network, blockPlacement.txIndex)}
                className="font-mono text-sm text-network-cyan hover:text-network-cyan-light hover:underline"
              >
                Block #{blockPlacement.height} · slot {blockPlacement.txIndex}
              </Link>
            ) : embedded ? null : (
              <span className="font-mono text-sm text-[var(--text-muted)]">#{index}</span>
            )}
            {embedded ? null : (
              <span
                className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${kindBadgeTone(kind)}`}
              >
                {payloadKindLabel(kind)}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Signer</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Link href={explorerAccountHref(sender, network)} className="address-link text-sm">
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

      {deployedAssetHex ? (
        <div className="rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/35 via-boing-navy-mid/40 to-boing-black/30 p-4 sm:p-5">
          <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-fuchsia-200/90">
            Deployed asset
          </h4>
          <div className="mt-3 flex items-start gap-4">
            <AssetMediaThumb
              imageUrl={deployImageUrl}
              alt={deployLabel || "Deployed asset"}
              size="lg"
              kind={deployKindHint}
            />
            <div className="min-w-0 space-y-2">
              {deployLabel ? (
                <p className="font-display text-lg font-semibold text-[var(--text-primary)]">{deployLabel}</p>
              ) : null}
              {isNftPurposeOrKind(purposeCategory) ? (
                <p className="text-xs font-medium uppercase tracking-wide text-fuchsia-200/80">NFT collection</p>
              ) : null}
              <p className="text-sm text-[var(--text-secondary)]">
                {isNftPurposeOrKind(purposeCategory)
                  ? "New NFT collection account created by this deployment. Open the asset page for minted token previews, balances, and contract hints."
                  : "New on-chain account created by this deployment (token, NFT collection, or contract). Open the asset page for balances, nonce, and contract hints."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={explorerAssetHref(deployedAssetHex, network)} className="address-link text-sm font-semibold">
                  {shortenHash(deployedAssetHex)}
                </Link>
                <CopyButton value={toPrefixedHex64(deployedAssetHex)} label="Copy asset address" />
              </div>
              <p className="hash break-all text-[0.65rem] text-[var(--text-muted)]">0x{deployedAssetHex}</p>
            </div>
          </div>
        </div>
      ) : null}

      {kind === "Transfer" ? (
        <TransferFlowDiagram
          sender={tx.sender}
          payload={payloadInner}
          network={network}
          scale={visualScale}
          failed={txFailed}
          feeBoing={txFeeBoing}
          height={txHeight}
        />
      ) : null}
      {featured && kind === "Bond" ? (
        <StakeMovementVisual
          kind="Bond"
          sender={tx.sender}
          payload={payloadInner}
          network={network}
          failed={txFailed}
          feeBoing={txFeeBoing}
          height={txHeight}
        />
      ) : null}
      {featured && kind === "Unbond" ? (
        <StakeMovementVisual
          kind="Unbond"
          sender={tx.sender}
          payload={payloadInner}
          network={network}
          failed={txFailed}
          feeBoing={txFeeBoing}
          height={txHeight}
        />
      ) : null}
      {featured && kind === "ContractCall" ? (
        <ContractCallFeaturedVisual payload={payloadInner} network={network} />
      ) : null}

      {blobDownloadHint ? <BlobDownloadPanel hint={blobDownloadHint} network={network} /> : null}

      {showContextNote ? (
        <p className="text-sm leading-snug text-[var(--text-secondary)]">
          <TxContextNarrativeRich kind={kind} sender={tx.sender} payload={tx.payload} network={network} height={txHeight} />
        </p>
      ) : null}

      {kind !== "Unknown" ? (
        <div className="rounded-xl border border-network-primary/35 bg-gradient-to-br from-network-primary/[0.12] via-boing-navy-mid/50 to-boing-black/40 p-4 sm:p-5">
          <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-network-primary-light/90">
            What you signed
          </h4>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)] sm:text-[0.95rem]">
            <SignedPayloadHeadlineRich kind={kind} inner={payloadInner} network={network} failed={txFailed} height={txHeight} />
          </p>
          {detailLines.length > 0 ? (
            <>
              <h5 className="mt-4 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Payload fields
              </h5>
              <dl className="mt-2 space-y-2.5 border-t border-[var(--border-color)]/60 pt-3">
                {detailLines.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                    <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] sm:w-36">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.imageUrl ? (
                          <AssetMediaThumb imageUrl={row.imageUrl} alt={row.value} size="sm" />
                        ) : null}
                        {row.accountHex64 ? (
                          <Link
                            href={
                              row.label === "Recipient" || row.label === "Signer"
                                ? explorerAccountHref(row.accountHex64, network)
                                : explorerAssetHref(row.accountHex64, network)
                            }
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
            </>
          ) : null}
        </div>
      ) : (
        <div
          className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 p-4 text-sm text-[var(--text-secondary)]"
          role="status"
        >
          This payload is not a known Boing shape (flat or tagged). Open{" "}
          <strong className="text-[var(--text-primary)]">Exact payload (JSON)</strong> below for the bytes the node
          returned.
        </div>
      )}

      <AccessListPanel tx={tx} network={network} />

      {receiptsWereRequested ? (
        receipt ? (
          <ReceiptPanel
            receipt={receipt}
            network={network}
            showTransactionPageLink={!blockPlacement}
            height={txHeight}
          />
        ) : (
          <div
            className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/30 p-3 text-sm text-[var(--text-muted)]"
            role="status"
          >
            No receipt from this node. Payload above is still what was signed.
          </div>
        )
      ) : null}

      <details className="rounded-lg border border-[var(--border-color)] bg-boing-black/30">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5">
          Exact payload (JSON)
        </summary>
        <pre className="max-h-[min(320px,50vh)] overflow-auto border-t border-[var(--border-color)] p-3 text-xs text-[var(--text-secondary)] hash">
          {JSON.stringify(tx.payload, null, 2)}
        </pre>
      </details>
    </article>
  );
}
