/**
 * Infer transaction payload type from payload object for display.
 * Matches spec: Transfer, Bond, Unbond, ContractCall, ContractDeploy, ContractDeployWithPurpose.
 */

import type { TxPayloadKind } from "./rpc-types";
import { toSafeHexString } from "./rpc-types";
import { TESTNET_FAUCET_ACCOUNT_HEX } from "./testnet-constants";

/** Serde-style tagged enums: `{ "Bond": { "amount": "1" } }` — unwrap to inner body + kind. */
const TAGGED_PAYLOAD_KIND_BY_KEY: Record<string, TxPayloadKind> = {
  Transfer: "Transfer",
  Bond: "Bond",
  Unbond: "Unbond",
  ContractCall: "ContractCall",
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
  return "Unknown";
}

export function getTxPayloadKind(payload: unknown): TxPayloadKind {
  if (!payload || typeof payload !== "object") return "Unknown";
  const { inner, taggedKind } = unwrapTaggedPayload(payload);
  if (taggedKind) return taggedKind;
  return getTxPayloadKindFlat(inner);
}

export function getTxPayloadSummary(payload: unknown): string {
  const kind = getTxPayloadKind(payload);
  if (kind === "Unknown") return "—";
  const p = getTxPayloadInner(payload);
  switch (kind) {
    case "Transfer":
      return `to ${formatShortAddr(p.to)} · ${formatBoingAmount(String(p.amount ?? ""))} BOING`;
    case "Bond":
      return `${formatBoingAmount(String(p.amount ?? ""))} BOING stake`;
    case "Unbond":
      return `unbond ${formatBoingAmount(String(p.amount ?? ""))} BOING`;
    case "ContractCall":
      return `contract ${formatShortAddr(p.contract)}`;
    case "ContractDeploy":
      return "deploy contract";
    case "ContractDeployWithPurpose":
      return `deploy contract · ${formatPurpose(String(p.purpose_category ?? "other"))}`;
    case "ContractDeployWithPurposeAndMetadata": {
      const meta = [p.asset_name, p.asset_symbol].filter(Boolean).join(" · ");
      return `deploy · ${formatPurpose(String(p.purpose_category ?? "other"))}${meta ? ` · ${meta}` : ""}`;
    }
    default:
      return "—";
  }
}

function formatShortAddr(value: unknown): string {
  const s = toSafeHexString(value);
  const h = s.startsWith("0x") ? s.slice(2) : s;
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h || "—";
}

function formatPurpose(cat: string): string {
  if (!cat || cat === "other") return "other";
  return cat.toLowerCase();
}

/** Whole BOING units from RPC (u128 string). No fractional display — decimals must stay 0 here. */
export function formatBoingAmount(raw: string): string {
  if (!/^\d+$/.test(raw)) return raw;
  if (raw === "0") return "0";
  return raw.replace(/^0+/, "") || "0";
}

/**
 * Short, user-facing sentence for the signed payload (complements badges and charts).
 */
export function getSignedPayloadHeadline(kind: TxPayloadKind, inner: Record<string, unknown>): string {
  const amt = (k: string) => formatBoingAmount(String(inner[k] ?? "0"));
  switch (kind) {
    case "Bond":
      return `You signed a bond (stake) of ${amt("amount")} BOING — it moves from liquid balance into validator stake when executed.`;
    case "Unbond":
      return `You signed an unbond of ${amt("amount")} BOING — stake begins leaving per protocol rules when executed.`;
    case "Transfer":
      return `You signed a transfer of ${amt("amount")} BOING to ${formatShortAddr(inner.to)}.`;
    case "ContractCall":
      return `You signed a call to contract ${formatShortAddr(inner.contract)}${inner.calldata ? " with calldata" : ""}.`;
    case "ContractDeploy":
      return "You signed a contract deployment (bytecode in payload).";
    case "ContractDeployWithPurpose":
      return `You signed a contract deployment with purpose ${formatPurpose(String(inner.purpose_category ?? "other"))}.`;
    case "ContractDeployWithPurposeAndMetadata": {
      const meta = [inner.asset_name, inner.asset_symbol].filter(Boolean).join(" · ");
      return `You signed a deployment (${formatPurpose(String(inner.purpose_category ?? "other"))}${meta ? ` · ${meta}` : ""}).`;
    }
    case "Unknown":
      return "";
    default: {
      const _ex: never = kind;
      return _ex;
    }
  }
}

function senderHexNormalized(sender: unknown): string {
  const s = toSafeHexString(sender);
  const h = s.startsWith("0x") ? s.slice(2) : s;
  return h.toLowerCase();
}

/**
 * Plain-language explanation for block detail (one row per transaction).
 */
export function getTxExplorerNarrative(sender: unknown, payload: unknown): string {
  const kind = getTxPayloadKind(payload);
  const from = senderHexNormalized(sender);
  const p = getTxPayloadInner(payload);

  if (kind === "Transfer") {
    const amount = formatBoingAmount(String(p.amount ?? ""));
    const isFaucet = from === TESTNET_FAUCET_ACCOUNT_HEX.toLowerCase();
    if (isFaucet) {
      return `Testnet faucet → ${formatShortAddr(p.to)} · ${amount} BOING`;
    }
    return `${formatShortAddr(sender)} → ${formatShortAddr(p.to)} · ${amount} BOING`;
  }

  if (kind === "Bond") {
    return `Stake (bond) · ${formatBoingAmount(String(p.amount ?? ""))} BOING`;
  }
  if (kind === "Unbond") {
    return `Unbond · ${formatBoingAmount(String(p.amount ?? ""))} BOING`;
  }
  if (kind === "ContractCall") {
    return `Call ${formatShortAddr(p.contract)}`;
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
