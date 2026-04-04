/**
 * Infer transaction payload type from payload object for display.
 * Matches spec: Transfer, Bond, Unbond, ContractCall, ContractDeploy, ContractDeployWithPurpose.
 */

import type { TxPayloadKind } from "./rpc-types";
import { toSafeHexString } from "./rpc-types";
import { TESTNET_FAUCET_ACCOUNT_HEX } from "./testnet-constants";

export function getTxPayloadKind(payload: unknown): TxPayloadKind {
  if (!payload || typeof payload !== "object") return "Unknown";
  const p = payload as Record<string, unknown>;
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

export function getTxPayloadSummary(payload: unknown): string {
  const kind = getTxPayloadKind(payload);
  if (kind === "Unknown") return "—";
  const p = payload as Record<string, unknown>;
  switch (kind) {
    case "Transfer":
      return `to ${formatShortAddr(p.to)} · ${formatBoingAmount(String(p.amount ?? ""))} BOING`;
    case "Bond":
      return `${formatBoingAmount(String(p.amount))} BOING stake`;
    case "Unbond":
      return `unbond ${formatBoingAmount(String(p.amount))} BOING`;
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

/** Whole BOING units from RPC (u128 string). */
export function formatBoingAmount(raw: string): string {
  if (!/^\d+$/.test(raw)) return raw;
  const decimals = 0;
  if (raw === "0") return "0";
  let padded = raw.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals).replace(/^0+/, "") || "0";
  const fracPart = padded.slice(-decimals).replace(/0+$/, "").slice(0, 4);
  return fracPart ? `${intPart}.${fracPart}` : intPart;
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
  const p = payload as Record<string, unknown>;

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
