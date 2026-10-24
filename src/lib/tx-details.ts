/**
 * Structured fields for transaction insight UI (payload + hex previews).
 */

import type { TxPayloadKind } from "./rpc-types";
import { hexForLink, shortenHash, toSafeHexString } from "./rpc-types";
import {
  batchCallValueTotal,
  batchSteps,
  contractCallValue,
  formatBoingAmount,
  getTxPayloadKind,
  getTxPayloadInner,
} from "./tx-payload";
import { formatPurposeLabel } from "./asset-kind-label";
import { parseAssetDisplayMetadata } from "./extract-media-url";

function formatBoingName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) return "—";
  return s.endsWith(".boing") ? s : `${s}.boing`;
}

export type TxDetailLine = {
  label: string;
  value: string;
  /** Link target for explorer `/asset/[hex]` (64 hex, no 0x). */
  accountHex64?: string;
  /** Full string for copy-to-clipboard (e.g. full calldata hex). */
  copyValue?: string;
  /** Remote token/NFT image to render next to the value. */
  imageUrl?: string;
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

export function buildPayloadDetailLines(payload: unknown, height?: number | null, network?: string | null): TxDetailLine[] {
  const kind = getTxPayloadKind(payload);
  const p = getTxPayloadInner(payload);
  const lines: TxDetailLine[] = [];

  switch (kind) {
    case "Transfer": {
      const to = hexForLink(p.to);
      lines.push({ label: "Recipient", value: shortenHash(to) || "—", accountHex64: to || undefined });
      lines.push({ label: "Amount", value: `${formatBoingAmount(String(p.amount ?? ""), height, network)} BOING` });
      return lines;
    }
    case "Bond":
      lines.push({ label: "Stake amount", value: `${formatBoingAmount(String(p.amount ?? ""), height, network)} BOING` });
      return lines;
    case "Unbond":
      lines.push({ label: "Unbond amount", value: `${formatBoingAmount(String(p.amount ?? ""), height, network)} BOING` });
      return lines;
    case "ClaimUnbond":
      lines.push({
        label: "Action",
        value: "Claim unbond — move matured pending_unbond back to liquid BOING",
      });
      return lines;
    case "QaPoolVote": {
      const subj = hexForLink(p.subject ?? p.subject_hex);
      lines.push({ label: "Vote", value: String(p.vote ?? "—") });
      lines.push({
        label: "Subject (pending deploy tx)",
        value: shortenHash(subj) || "—",
        // subject is a tx id (32-byte), surface as copyable hex via account field unused
        copyValue: subj ? `0x${subj}` : undefined,
      });
      return lines;
    }
    case "ContractCall": {
      const c = hexForLink(p.contract);
      lines.push({
        label: "Contract account",
        value: shortenHash(c) || "—",
        accountHex64: c || undefined,
      });
      const value = contractCallValue(p);
      if (value) {
        lines.push({ label: "BOING sent to contract", value: `${formatBoingAmount(value, height, network)} BOING` });
      }
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
    case "Batch": {
      const steps = batchSteps(p);
      lines.push({ label: "Steps", value: `${steps.length} (all succeed or all revert)` });
      steps.forEach((s, i) => {
        const label = `Step ${i + 1}`;
        if (s.kind === "Transfer") {
          const to = hexForLink(s.to);
          lines.push({
            label,
            value: `Transfer ${formatBoingAmount(s.amount, height, network)} BOING to ${shortenHash(to) || "—"}`,
            accountHex64: to || undefined,
          });
        } else if (s.kind === "ContractCall") {
          const c = hexForLink(s.contract);
          const cd = normalizeHexData(s.calldata);
          const v = s.value ? ` · sends ${formatBoingAmount(s.value, height, network)} BOING` : "";
          lines.push({
            label,
            value: `Call ${shortenHash(c) || "—"}${v} · calldata ${cd.bytes} bytes`,
            accountHex64: c || undefined,
            copyValue: cd.prefixed || undefined,
          });
        } else {
          lines.push({ label, value: "Unrecognized step" });
        }
      });
      const total = batchCallValueTotal(steps);
      if (total) lines.push({ label: "BOING sent to contracts", value: `${formatBoingAmount(total, height, network)} BOING` });
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
        lines.push({
          label: "Purpose category",
          value: formatPurposeLabel(String(p.purpose_category ?? "other")),
        });
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
      if ("asset_name" in p || "asset_symbol" in p) {
        const parsed = parseAssetDisplayMetadata(
          typeof p.asset_name === "string" ? p.asset_name : null,
          typeof p.asset_symbol === "string" ? p.asset_symbol : null,
        );
        lines.push({
          label: "Asset name",
          value: parsed.displayName ?? (typeof p.asset_name === "string" && !parsed.imageUrl ? String(p.asset_name) : "—"),
        });
        lines.push({
          label: "Asset symbol",
          value: parsed.displaySymbol ?? (typeof p.asset_symbol === "string" ? String(p.asset_symbol) : "—"),
        });
        if (parsed.imageUrl) {
          lines.push({ label: "Image", value: parsed.imageUrl, imageUrl: parsed.imageUrl, copyValue: parsed.imageUrl });
        }
      }
      return lines;
    }
    case "NameCommit": {
      const c = hexForLink(p.commitment);
      lines.push({
        label: "Commitment",
        value: shortenHash(c) || "—",
        copyValue: c ? `0x${c}` : undefined,
      });
      return lines;
    }
    case "NameRegister": {
      lines.push({ label: "Name", value: formatBoingName(p.name) });
      const target = hexForLink(p.target);
      lines.push({ label: "Target", value: shortenHash(target) || "—", accountHex64: target || undefined });
      lines.push({ label: "Years", value: String(p.years ?? "—") });
      const salt = normalizeHexData(p.salt);
      if (salt.bytes > 0) {
        lines.push({ label: "Salt", value: hexPreview(salt.prefixed, 32), copyValue: salt.prefixed });
      }
      return lines;
    }
    case "NameRenew":
      lines.push({ label: "Name", value: formatBoingName(p.name) });
      lines.push({ label: "Years", value: String(p.years ?? "—") });
      return lines;
    case "NameTransfer": {
      lines.push({ label: "Name", value: formatBoingName(p.name) });
      const owner = hexForLink(p.new_owner);
      lines.push({ label: "New owner", value: shortenHash(owner) || "—", accountHex64: owner || undefined });
      return lines;
    }
    case "NameSetTarget": {
      lines.push({ label: "Name", value: formatBoingName(p.name) });
      const target = hexForLink(p.target);
      lines.push({ label: "Target", value: shortenHash(target) || "—", accountHex64: target || undefined });
      return lines;
    }
    case "NameSetPrimary":
      lines.push({
        label: "Primary name",
        value: p.name == null || p.name === "" ? "(cleared)" : formatBoingName(p.name),
      });
      return lines;
    case "NameRelease":
      lines.push({ label: "Name", value: formatBoingName(p.name) });
      return lines;
    case "ValidatorRegister": {
      const node = hexForLink(p.node_id ?? p.nodeId);
      lines.push({ label: "Node id", value: shortenHash(node) || "—", accountHex64: node || undefined });
      return lines;
    }
    case "ValidatorDeregister":
    case "ValidatorUnjail": {
      const node = hexForLink(p.node_id ?? p.nodeId);
      lines.push({ label: "Node id", value: shortenHash(node) || "—", accountHex64: node || undefined });
      return lines;
    }
    case "PutBlob":
    case "BlobAnnounce":
    case "RenewMediaBlobPin":
    case "PayBlobSample":
    case "RegisterBlobSampleOffer":
    case "SettleBlobSampleMatch":
    case "CancelBlobSampleOffer":
    case "ChallengeBlobSampleServe":
    case "RespondBlobSampleServe": {
      const blob = hexForLink(p.blob_id ?? p.blobId);
      if (blob) {
        lines.push({ label: "Blob id", value: shortenHash(blob) || "—", copyValue: `0x${blob}` });
      }
      if (p.size != null) lines.push({ label: "Size", value: String(p.size) });
      if (p.chunk_index != null || p.chunkIndex != null) {
        lines.push({ label: "Chunk index", value: String(p.chunk_index ?? p.chunkIndex) });
      }
      return lines;
    }
    case "SubmitSlashAppeal":
      lines.push({ label: "Slash id", value: String(p.slash_id ?? p.slashId ?? "—") });
      return lines;
    case "ResolveSlashAppeal":
    case "ResolveSlashAppealAttested":
    case "ResolveSlashAppealBlsAggregate":
      lines.push({ label: "Appeal id", value: String(p.appeal_id ?? p.appealId ?? "—") });
      lines.push({ label: "Approved", value: String(p.approved ?? "—") });
      return lines;
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
    case "ClaimUnbond":
    case "ValidatorRegister":
    case "ValidatorDeregister":
    case "ValidatorUnjail":
      return "border-network-primary/40 bg-network-primary/15 text-network-primary-light";
    case "QaPoolVote":
    case "SubmitSlashAppeal":
    case "ResolveSlashAppeal":
    case "ResolveSlashAppealAttested":
    case "ResolveSlashAppealBlsAggregate":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "ContractCall":
    case "Batch":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "ContractDeploy":
    case "ContractDeployWithPurpose":
    case "ContractDeployWithPurposeAndMetadata":
      return "border-fuchsia-500/35 bg-fuchsia-950/30 text-fuchsia-200";
    case "NameCommit":
    case "NameRegister":
    case "NameRenew":
    case "NameTransfer":
    case "NameSetTarget":
    case "NameSetPrimary":
    case "NameRelease":
      return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    case "PutBlob":
    case "BlobAnnounce":
    case "RenewMediaBlobPin":
    case "PayBlobSample":
    case "RegisterBlobSampleOffer":
    case "SettleBlobSampleMatch":
    case "CancelBlobSampleOffer":
    case "ChallengeBlobSampleServe":
    case "RespondBlobSampleServe":
      return "border-violet-500/35 bg-violet-950/25 text-violet-200";
    case "Unknown":
      return "border-[var(--border-color)] bg-white/5 text-[var(--text-muted)]";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
