import { compactBoingAt, formatBoingAt } from "./native-unit";
/**
 * Infer transaction payload type from payload object for display.
 * Tagged shapes come from serde externally tagged enums (RPC); flat shapes are
 * heuristics for ad-hoc JSON. Catalog keys are driven by SDK `PayloadVariant`.
 */

import type { TxPayloadKind } from "./rpc-types";
import { toSafeHexString } from "./rpc-types";
import { TESTNET_FAUCET_ACCOUNT_HEX } from "./testnet-constants";
import { formatPurposeLabel } from "./asset-kind-label";
import { formatAssetDisplayLabel, parseAssetDisplayMetadata } from "./extract-media-url";
import { payloadKindLabel, resolveTaggedPayloadKind } from "./tx-payload-catalog";

export { payloadKindLabel } from "./tx-payload-catalog";

/**
 * Inner record used for amounts, addresses, bytecode (after unwrapping a one-key tagged payload).
 */
export function unwrapTaggedPayload(payload: unknown): {
  inner: Record<string, unknown>;
  taggedKind: TxPayloadKind | null;
} {
  // Unit variants serialize as a bare string: `"ClaimUnbond"`.
  if (typeof payload === "string") {
    const taggedKind = resolveTaggedPayloadKind(payload);
    return taggedKind ? { inner: {}, taggedKind } : { inner: {}, taggedKind: null };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { inner: {}, taggedKind: null };
  }
  const p = payload as Record<string, unknown>;
  const keys = Object.keys(p);
  if (keys.length !== 1) {
    return { inner: p, taggedKind: null };
  }
  const key = keys[0];
  const val = p[key];
  const taggedKind = resolveTaggedPayloadKind(key);
  if (!taggedKind) {
    return { inner: p, taggedKind: null };
  }
  // Unit / empty body: `{ "ClaimUnbond": null }` or `{}` / `[]`.
  if (val === null || val === undefined) {
    return { inner: {}, taggedKind };
  }
  if (typeof val !== "object" || Array.isArray(val)) {
    // Non-object bodies are rare; keep the tag and empty inner.
    return { inner: {}, taggedKind };
  }
  return { inner: val as Record<string, unknown>, taggedKind };
}

export function getTxPayloadInner(payload: unknown): Record<string, unknown> {
  return unwrapTaggedPayload(payload).inner;
}

function hasKeys(p: Record<string, unknown>, required: string[]): boolean {
  return required.every((k) => k in p);
}

function getTxPayloadKindFlat(p: Record<string, unknown>): TxPayloadKind {
  if ("bytecode" in p) {
    if (!("purpose_category" in p)) return "ContractDeploy";
    if ("asset_name" in p || "asset_symbol" in p) {
      return "ContractDeployWithPurposeAndMetadata";
    }
    return "ContractDeployWithPurpose";
  }
  if ("contract" in p) return "ContractCall";
  if (Array.isArray(p.calls)) return "Batch";
  if ("to" in p && "amount" in p) return "Transfer";

  // Name registry (Express / SDK flat `{ kind: "name_register", … }` or field-shaped JSON).
  const kindStr = typeof p.kind === "string" ? p.kind : "";
  if (kindStr) {
    const fromKind = resolveTaggedPayloadKind(kindStr);
    if (fromKind) return fromKind;
  }
  if (hasKeys(p, ["name", "salt", "target", "years"])) return "NameRegister";
  if (hasKeys(p, ["name", "years"]) && !("salt" in p) && !("target" in p) && !("new_owner" in p)) {
    return "NameRenew";
  }
  if (hasKeys(p, ["name", "new_owner"])) return "NameTransfer";
  if (hasKeys(p, ["name", "target"]) && !("salt" in p) && !("years" in p)) return "NameSetTarget";
  if ("commitment" in p && !("name" in p) && !("to" in p) && !("amount" in p)) return "NameCommit";
  // NameRelease / NameSetPrimary need a tagged key or `kind` — both are `{ name }` shaped.
  if ("node_id" in p || "nodeId" in p) {
    if ("node_signature" in p || "nodeSignature" in p) return "ValidatorRegister";
    return "ValidatorDeregister";
  }

  if ("amount" in p && Object.keys(p).length <= 2) {
    if ("amount" in p && !("to" in p)) {
      const keys = Object.keys(p).sort().join(",");
      if (keys === "amount" || keys === "amount,unbond" || keys === "unbond,amount") return "Unbond";
      return "Bond";
    }
  }
  if ("amount" in p && !("to" in p) && !("contract" in p)) {
    return "Unbond";
  }
  if ("amount" in p && !("to" in p)) return "Bond";
  if (("subject" in p || "subject_hex" in p) && "vote" in p) return "QaPoolVote";
  if (p.kind === "claim_unbond" || p.kind === "ClaimUnbond") return "ClaimUnbond";

  // Media blob / slash appeal field heuristics (tagged path is preferred).
  if ("data" in p && ("retention" in p || "content_type" in p)) return "PutBlob";
  if ("blob_id" in p || "blobId" in p) {
    if ("extend_blocks" in p || "extendBlocks" in p) return "RenewMediaBlobPin";
    if ("ask_fee" in p || "askFee" in p) return "RegisterBlobSampleOffer";
    if ("siblings" in p) return "RespondBlobSampleServe";
    if ("challenger" in p) return "RespondBlobSampleServe";
    if ("provider" in p && ("chunk_count" in p || "chunkCount" in p)) {
      return "chunk_hash" in p || "chunkHash" in p ? "RespondBlobSampleServe" : "SettleBlobSampleMatch";
    }
    if (("size" in p || typeof p.size === "number") && ("retention" in p || "content_type" in p)) {
      return "BlobAnnounce";
    }
    if ("chunk_index" in p || "chunkIndex" in p) return "PayBlobSample";
  }
  if ("slash_id" in p || "slashId" in p) return "SubmitSlashAppeal";
  if ("appeal_id" in p || "appealId" in p) {
    if ("aggregate_signature" in p || "aggregateSignature" in p) return "ResolveSlashAppealBlsAggregate";
    if ("ballot_signature" in p || "ballotSignature" in p) return "ResolveSlashAppealAttested";
    return "ResolveSlashAppeal";
  }

  return "Unknown";
}

export function getTxPayloadKind(payload: unknown): TxPayloadKind {
  if (payload == null) return "Unknown";
  const { inner, taggedKind } = unwrapTaggedPayload(payload);
  if (taggedKind) return taggedKind;
  return getTxPayloadKindFlat(inner);
}

/** Native BOING a contract call sends (`ContractCallWithValue.value`), or null when none / zero. */
export function contractCallValue(inner: Record<string, unknown>): string | null {
  const v = inner.value;
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
  return /^\d+$/.test(s) && !/^0+$/.test(s) ? s : null;
}

export type BatchStep =
  | { kind: "Transfer"; to: unknown; amount: string }
  | { kind: "ContractCall"; contract: unknown; calldata: unknown; value: string | null }
  | { kind: "Unknown" };

/** Steps of a `Batch` payload (`{ calls: [{ Transfer }, { ContractCall }, { ContractCallWithValue }] }`). */
export function batchSteps(inner: Record<string, unknown>): BatchStep[] {
  const calls = Array.isArray(inner.calls) ? inner.calls : [];
  return calls.map((c): BatchStep => {
    const { inner: s, taggedKind } = unwrapTaggedPayload(c);
    const kind = taggedKind ?? getTxPayloadKindFlat(s);
    if (kind === "Transfer") return { kind, to: s.to, amount: String(s.amount ?? "") };
    if (kind === "ContractCall") return { kind, contract: s.contract, calldata: s.calldata, value: contractCallValue(s) };
    return { kind: "Unknown" };
  });
}

/** Total native BOING the batch's contract-call steps send (ledger units), or null when none. */
export function batchCallValueTotal(steps: BatchStep[]): string | null {
  let t = BigInt(0);
  for (const s of steps) if (s.kind === "ContractCall" && s.value) t += BigInt(s.value);
  return t > BigInt(0) ? t.toString() : null;
}

export function isContractDeployPayloadKind(kind: TxPayloadKind): boolean {
  switch (kind) {
    case "ContractDeploy":
    case "ContractDeployWithPurpose":
    case "ContractDeployWithPurposeAndMetadata":
      return true;
    default:
      return false;
  }
}

function formatBoingName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) return "—";
  return s.endsWith(".boing") ? s : `${s}.boing`;
}

/**
 * One-line payload summary. `height` is the block the tx is in: native amounts below the 18-decimals
 * switch are whole BOING, base units from it (unknown height = current, base units).
 */
export function getTxPayloadSummary(payload: unknown, height?: number | null, network?: string | null): string {
  const boing = (raw: unknown) => `${compactBoingAt(String(raw ?? ""), height, network).short} BOING`;
  const kind = getTxPayloadKind(payload);
  if (kind === "Unknown") return "—";
  const p = getTxPayloadInner(payload);
  switch (kind) {
    case "Transfer":
      return `to ${formatShortAddr(p.to)} · ${boing(p.amount)}`;
    case "Bond":
      return `${boing(p.amount)} stake`;
    case "Unbond":
      return `unbond ${boing(p.amount)}`;
    case "ContractCall": {
      const v = contractCallValue(p);
      return `contract ${formatShortAddr(p.contract)}${v ? ` · sends ${boing(v)}` : ""}`;
    }
    case "Batch": {
      const steps = batchSteps(p);
      const v = batchCallValueTotal(steps);
      return `batch · ${steps.length} step${steps.length === 1 ? "" : "s"}${v ? ` · sends ${boing(v)}` : ""}`;
    }
    case "ContractDeploy":
      return "deploy contract";
    case "ContractDeployWithPurpose":
      return `deploy contract · ${formatPurpose(String(p.purpose_category ?? "other"))}`;
    case "ContractDeployWithPurposeAndMetadata": {
      const meta = deployAssetLabel(p);
      return `deploy · ${formatPurpose(String(p.purpose_category ?? "other"))}${meta ? ` · ${meta}` : ""}`;
    }
    case "ClaimUnbond":
      return "claim unbond";
    case "QaPoolVote":
      return `QA vote · ${String(p.vote ?? "")} · ${formatShortAddr(p.subject ?? p.subject_hex)}`;
    case "NameCommit":
      return `name commit · ${formatShortAddr(p.commitment)}`;
    case "NameRegister":
      return `register ${formatBoingName(p.name)} · ${String(p.years ?? "")}y → ${formatShortAddr(p.target)}`;
    case "NameRenew":
      return `renew ${formatBoingName(p.name)} · ${String(p.years ?? "")}y`;
    case "NameTransfer":
      return `transfer ${formatBoingName(p.name)} → ${formatShortAddr(p.new_owner)}`;
    case "NameSetTarget":
      return `retarget ${formatBoingName(p.name)} → ${formatShortAddr(p.target)}`;
    case "NameSetPrimary":
      return p.name == null || p.name === ""
        ? "clear primary name"
        : `set primary ${formatBoingName(p.name)}`;
    case "NameRelease":
      return `release ${formatBoingName(p.name)}`;
    case "ValidatorRegister":
      return `validator register · node ${formatShortAddr(p.node_id ?? p.nodeId)}`;
    case "ValidatorDeregister":
      return `validator deregister · node ${formatShortAddr(p.node_id ?? p.nodeId)}`;
    case "ValidatorUnjail":
      return `validator unjail · node ${formatShortAddr(p.node_id ?? p.nodeId)}`;
    case "PutBlob":
      return "put media blob";
    case "BlobAnnounce":
      return `blob announce · ${formatShortAddr(p.blob_id ?? p.blobId)}`;
    case "RenewMediaBlobPin":
      return `renew blob pin · ${formatShortAddr(p.blob_id ?? p.blobId)}`;
    case "PayBlobSample":
    case "RegisterBlobSampleOffer":
    case "SettleBlobSampleMatch":
    case "CancelBlobSampleOffer":
    case "ChallengeBlobSampleServe":
    case "RespondBlobSampleServe":
      return `${payloadKindLabel(kind).toLowerCase()} · ${formatShortAddr(p.blob_id ?? p.blobId)}`;
    case "SubmitSlashAppeal":
      return `slash appeal · id ${String(p.slash_id ?? p.slashId ?? "")}`;
    case "ResolveSlashAppeal":
    case "ResolveSlashAppealAttested":
    case "ResolveSlashAppealBlsAggregate":
      return `${payloadKindLabel(kind).toLowerCase()} · id ${String(p.appeal_id ?? p.appealId ?? "")}`;
    default:
      return payloadKindLabel(kind);
  }
}

function deployAssetLabel(inner: Record<string, unknown>): string {
  const parsed = parseAssetDisplayMetadata(
    typeof inner.asset_name === "string" ? inner.asset_name : null,
    typeof inner.asset_symbol === "string" ? inner.asset_symbol : null,
  );
  return formatAssetDisplayLabel(parsed, "");
}

function formatShortAddr(value: unknown): string {
  const s = toSafeHexString(value);
  const h = s.startsWith("0x") ? s.slice(2) : s;
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h || "—";
}

function formatPurpose(cat: string): string {
  return formatPurposeLabel(cat);
}

/**
 * Exact BOING for a native ledger amount (u128 string) committed at `height`: whole BOING below the
 * 18-decimals switch, base units (1 BOING = 10^18) from it. Non-integers pass through.
 */
export function formatBoingAmount(raw: string, height?: number | null, network?: string | null): string {
  if (!/^\d+$/.test(raw)) return raw;
  return formatBoingAt(raw, height, network);
}

function senderHexNormalized(sender: unknown): string {
  const s = toSafeHexString(sender);
  const h = s.startsWith("0x") ? s.slice(2) : s;
  return h.toLowerCase();
}

/**
 * Plain-language explanation for block detail (one row per transaction).
 */
export function getTxExplorerNarrative(
  sender: unknown,
  payload: unknown,
  height?: number | null,
  network?: string | null,
): string {
  const boing = (raw: unknown) => `${compactBoingAt(String(raw ?? ""), height, network).short} BOING`;
  const kind = getTxPayloadKind(payload);
  const from = senderHexNormalized(sender);
  const p = getTxPayloadInner(payload);

  if (kind === "Transfer") {
    const amount = compactBoingAt(String(p.amount ?? ""), height, network).short;
    const isFaucet = from === TESTNET_FAUCET_ACCOUNT_HEX.toLowerCase();
    if (isFaucet) {
      return `Testnet faucet → ${formatShortAddr(p.to)} · ${amount} BOING`;
    }
    return `${formatShortAddr(sender)} → ${formatShortAddr(p.to)} · ${amount} BOING`;
  }

  if (kind === "Bond") {
    return `Stake (bond) · ${boing(p.amount)}`;
  }
  if (kind === "Unbond") {
    return `Unbond · ${boing(p.amount)}`;
  }
  if (kind === "ContractCall") {
    const v = contractCallValue(p);
    return `Call ${formatShortAddr(p.contract)}${v ? ` · sends ${boing(v)}` : ""}`;
  }
  if (kind === "Batch") {
    const steps = batchSteps(p);
    const v = batchCallValueTotal(steps);
    return `Batch of ${steps.length} step${steps.length === 1 ? "" : "s"} (all or nothing)${v ? ` · sends ${boing(v)} to contracts` : ""}`;
  }
  if (
    kind === "ContractDeploy" ||
    kind === "ContractDeployWithPurpose" ||
    kind === "ContractDeployWithPurposeAndMetadata"
  ) {
    return `Contract deploy · ${formatShortAddr(sender)} (QA may apply)`;
  }
  if (kind === "Unknown") {
    return "Payload shape not recognized by this explorer.";
  }
  const summary = getTxPayloadSummary(payload, height, network);
  return summary === "—" ? payloadKindLabel(kind) : summary;
}
