/**
 * Structured fields for transaction insight UI (payload + hex previews).
 */

import type { TxPayloadKind } from "./rpc-types";
import { hexForLink, shortenHash, toSafeHexString } from "./rpc-types";
import { formatBoingAmount, getTxPayloadKind } from "./tx-payload";

export type TxDetailLine = {
  label: string;
  value: string;
  /** Link target for explorer `/account/[hex]` (64 hex, no 0x). */
  accountHex64?: string;
  /** Full string for copy-to-clipboard (e.g. full calldata hex). */
  copyValue?: string;
};

/** Normalize RPC hex or byte array to lowercase `0x…` and byte length. */
export function normalizeHexData(value: unknown): { prefixed: string; bytes: number } {
  const s = toSafeHexString(value);
  if (!s) return { prefixed: "", bytes: 0 };
  const h = (s.startsWith("0x") ? s.slice(2) : s).replace(/[^0-9a-fA-F]/g, "");
  if (!h.length) return { prefixed: "", bytes: 0 };
  const lower = h.toLowerCase();
  return { prefixed: `0x${lower}`, bytes: Math.floor(lower.length / 2) };
}

export function hexPreview(prefixed: string, maxHexChars = 48): string {
  const h = prefixed.replace(/^0x/i, "");
  if (!h.length) return "—";
  if (h.length <= maxHexChars) return `0x${h}`;
  return `0x${h.slice(0, maxHexChars)}… (${Math.floor(h.length / 2)} bytes)`;
}

export function buildPayloadDetailLines(payload: unknown): TxDetailLine[] {
  const kind = getTxPayloadKind(payload);
  const p = payload as Record<string, unknown>;
  const lines: TxDetailLine[] = [];

  switch (kind) {
    case "Transfer": {
      const to = hexForLink(p.to);
      lines.push({ label: "Recipient", value: shortenHash(to) || "—", accountHex64: to || undefined });
      lines.push({ label: "Amount", value: `${formatBoingAmount(String(p.amount ?? ""))} BOING` });
      return lines;
    }
    case "Bond":
      lines.push({ label: "Stake amount", value: `${formatBoingAmount(String(p.amount ?? ""))} BOING` });
      return lines;
    case "Unbond":
      lines.push({ label: "Unbond amount", value: `${formatBoingAmount(String(p.amount ?? ""))} BOING` });
      return lines;
    case "ContractCall": {
      const c = hexForLink(p.contract);
      lines.push({
        label: "Contract account",
        value: shortenHash(c) || "—",
        accountHex64: c || undefined,
      });
      const calldata = normalizeHexData(p.calldata);
      if (calldata.bytes > 0) {
        lines.push({
          label: "Calldata",
          value: hexPreview(calldata.prefixed, 56),
          copyValue: calldata.prefixed,
        });
      } else {
        lines.push({ label: "Calldata", value: "Empty (no call data bytes)" });
      }
      return lines;
    }
    case "ContractDeploy":
    case "ContractDeployWithPurpose":
    case "ContractDeployWithPurposeAndMetadata": {
      const bc = normalizeHexData(p.bytecode);
      if (bc.bytes > 0) {
        lines.push({
          label: "Bytecode",
          value: `${bc.bytes} bytes · ${hexPreview(bc.prefixed, 28)}`,
          copyValue: bc.prefixed,
        });
        const nib = bc.prefixed.replace(/^0x/, "").slice(0, 2);
        if (nib.toLowerCase() === "fd") {
          lines.push({
            label: "Deploy mode",
            value:
              "Init-code (0xFD prefix) — constructor may emit logs; return buffer holds deploy result.",
          });
        }
      } else {
        lines.push({ label: "Bytecode", value: "—" });
      }
      if (p.create2_salt != null && p.create2_salt !== undefined) {
        const salt = normalizeHexData(p.create2_salt);
        if (salt.bytes > 0) {
          lines.push({
            label: "CREATE2 salt",
            value: hexPreview(salt.prefixed, 32),
            copyValue: salt.prefixed,
          });
        }
      }
      if ("purpose_category" in p) {
        lines.push({ label: "Purpose category", value: String(p.purpose_category ?? "—") });
      }
      if (p.description_hash != null && p.description_hash !== undefined) {
        const dh = normalizeHexData(p.description_hash);
        if (dh.bytes > 0) {
          lines.push({
            label: "Description hash",
            value: hexPreview(dh.prefixed, 32),
            copyValue: dh.prefixed,
          });
        }
      }
      if ("asset_name" in p && p.asset_name != null) {
        lines.push({ label: "Asset name", value: String(p.asset_name) });
      }
      if ("asset_symbol" in p && p.asset_symbol != null) {
        lines.push({ label: "Asset symbol", value: String(p.asset_symbol) });
      }
      return lines;
    }
    default:
      return lines;
  }
}

export function kindBadgeTone(kind: TxPayloadKind): string {
  switch (kind) {
    case "Transfer":
      return "border-network-cyan/40 bg-network-cyan/15 text-network-cyan-light";
    case "Bond":
    case "Unbond":
      return "border-network-primary/40 bg-network-primary/15 text-network-primary-light";
    case "ContractCall":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "ContractDeploy":
    case "ContractDeployWithPurpose":
    case "ContractDeployWithPurposeAndMetadata":
      return "border-fuchsia-500/35 bg-fuchsia-950/30 text-fuchsia-200";
    case "Unknown":
      return "border-[var(--border-color)] bg-white/5 text-[var(--text-muted)]";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
