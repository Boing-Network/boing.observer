import { compactBoingAt, formatBoingAt } from "./native-unit";
/**
 * Infer transaction payload type from payload object for display.
 * Matches spec: Transfer, Bond, Unbond, ContractCall (incl. ContractCallWithValue), Batch, ContractDeploy,
 * ContractDeployWithPurpose.
 */

import type { TxPayloadKind } from "./rpc-types";
import { toSafeHexString } from "./rpc-types";
import { TESTNET_FAUCET_ACCOUNT_HEX } from "./testnet-constants";
import { formatPurposeLabel } from "./asset-kind-label";
import { formatAssetDisplayLabel, parseAssetDisplayMetadata } from "./extract-media-url";

/** Serde-style tagged enums: `{ "Bond": { "amount": "1" } }` — unwrap to inner body + kind. */
const TAGGED_PAYLOAD_KIND_BY_KEY: Record<string, TxPayloadKind> = {
  Transfer: "Transfer",
  Bond: "Bond",
  Unbond: "Unbond",
  ClaimUnbond: "ClaimUnbond",
  claim_unbond: "ClaimUnbond",
  QaPoolVote: "QaPoolVote",
  qa_pool_vote: "QaPoolVote",
  ContractCall: "ContractCall",
  // Contract call carrying native BOING (`{ contract, calldata, value }`): shown as a contract call with its value.
  ContractCallWithValue: "ContractCall",
  Batch: "Batch",
  ContractDeploy: "ContractDeploy",
  ContractDeployWithPurpose: "ContractDeployWithPurpose",
  ContractDeployWithPurposeAndMetadata: "ContractDeployWithPurposeAndMetadata",
};

function resolveTaggedPayloadKind(key: string): TxPayloadKind | null {
  if (key in TAGGED_PAYLOAD_KIND_BY_KEY) {
    return TAGGED_PAYLOAD_KIND_BY_KEY[key];
  }
  const lower = key.toLowerCase();
  for (const [canonical, kind] of Object.entries(TAGGED_PAYLOAD_KIND_BY_KEY)) {
    if (canonical.toLowerCase() === lower) return kind;
  }
  return null;
}

/**
 * Inner record used for amounts, addresses, bytecode (after unwrapping a one-key tagged payload).
 */
export function unwrapTaggedPayload(payload: unknown): {
  inner: Record<string, unknown>;
  taggedKind: TxPayloadKind | null;
} {
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
  if (val === null || typeof val !== "object" || Array.isArray(val)) {
    return { inner: p, taggedKind: null };
  }
  const taggedKind = resolveTaggedPayloadKind(key);
  if (!taggedKind) {
    return { inner: p, taggedKind: null };
  }
  return { inner: val as Record<string, unknown>, taggedKind };
}

export function getTxPayloadInner(payload: unknown): Record<string, unknown> {
  return unwrapTaggedPayload(payload).inner;
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
  return "Unknown";
}

export function getTxPayloadKind(payload: unknown): TxPayloadKind {
  if (!payload || typeof payload !== "object") return "Unknown";
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
    default:
      return "—";
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
  return "—";
}
