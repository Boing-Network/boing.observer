import { tryPredictDeployedContractAddressFromDeployTx } from "@/lib/deploy-contract-address";
import { receiptReturnDataHex, tryParseCreatedAccountIdFromDeployReturnData } from "@/lib/deploy-receipt";
import { hexForLink, normalizeHex64 } from "@/lib/rpc-types";
import type { TxPayloadKind } from "@/lib/rpc-types";
import {
  batchSteps,
  getTxPayloadInner,
  getTxPayloadKind,
  getTxPayloadSummary,
  isContractDeployPayloadKind,
} from "@/lib/tx-payload";
import { resolveTaggedPayloadKind } from "@/lib/tx-payload-catalog";

export const ACCOUNT_TX_HISTORY_WINDOWS = [64, 256, 1024] as const;
export const DEFAULT_ACCOUNT_TX_HISTORY_WINDOW = 256;

export type AccountTxRole = "sender" | "recipient" | "contract" | "created" | "access_list";

export type AccountTxHistoryItem = {
  blockHeight: number;
  txIndex: number;
  timestamp: number | null;
  txId: string | null;
  sender: string;
  kind: TxPayloadKind;
  summary: string;
  roles: AccountTxRole[];
  /** Receipt `success: false` (included, state reverted; since security fix #3 the sender still pays a fee). */
  failed?: boolean;
};

export type AccountTxHistoryScanBlock = {
  height: number;
  timestamp?: number | null;
  transactions: Array<{
    sender?: unknown;
    nonce?: unknown;
    payload?: unknown;
    access_list?: { read?: unknown[]; write?: unknown[] };
  }>;
  receipts?: Array<{ tx_id?: unknown; return_data?: unknown; returnData?: unknown; success?: boolean } | null> | null;
};

function asAccount64(value: unknown): string {
  const h = hexForLink(value);
  return h.length === 64 ? h : "";
}

function collectAccessListIds(list: { read?: unknown[]; write?: unknown[] } | undefined): string[] {
  if (!list) return [];
  const out: string[] = [];
  for (const raw of [...(list.read ?? []), ...(list.write ?? [])]) {
    const id = asAccount64(raw);
    if (id) out.push(id);
  }
  return out;
}

type HistoryReceipt = {
  tx_id?: unknown;
  return_data?: unknown;
  returnData?: unknown;
  success?: boolean;
} | null;

export function rolesForAccountInTx(
  account64: string,
  tx: AccountTxHistoryScanBlock["transactions"][number],
  receipt?: HistoryReceipt,
): AccountTxRole[] {
  const want = account64.toLowerCase();
  const roles: AccountTxRole[] = [];
  const sender = asAccount64(tx.sender);
  if (sender === want) roles.push("sender");

  const inner = getTxPayloadInner(tx.payload);
  const kind = getTxPayloadKind(tx.payload);
  if (kind === "Transfer" && asAccount64(inner.to) === want) roles.push("recipient");
  if (kind === "ContractCall" && asAccount64(inner.contract) === want) roles.push("contract");
  if (kind === "Batch") {
    for (const s of batchSteps(inner)) {
      if (s.kind === "Transfer" && asAccount64(s.to) === want && !roles.includes("recipient")) roles.push("recipient");
      if (s.kind === "ContractCall" && asAccount64(s.contract) === want && !roles.includes("contract")) roles.push("contract");
    }
  }

  if (isContractDeployPayloadKind(kind) && receipt?.success !== false) {
    const created =
      tryParseCreatedAccountIdFromDeployReturnData(receiptReturnDataHex(receipt)) ??
      tryPredictDeployedContractAddressFromDeployTx(tx, tx.payload);
    if (created === want) roles.push("created");
  }

  if (
    collectAccessListIds(tx.access_list).includes(want) &&
    !roles.includes("sender") &&
    !roles.includes("contract") &&
    !roles.includes("recipient") &&
    !roles.includes("created")
  ) {
    roles.push("access_list");
  }

  return roles;
}

export function collectAccountTxHistory(
  account64: string,
  blocks: AccountTxHistoryScanBlock[],
): AccountTxHistoryItem[] {
  const want = normalizeHex64(account64);
  if (!want) return [];
  const items: AccountTxHistoryItem[] = [];

  for (const block of blocks) {
    const txs = block.transactions ?? [];
    const receipts = block.receipts ?? [];
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (!tx) continue;
      const receipt = receipts[i] ?? null;
      const roles = rolesForAccountInTx(want, tx, receipt);
      if (!roles.length) continue;
      const txIdRaw = receipt && typeof receipt.tx_id === "string" ? normalizeHex64(String(receipt.tx_id).replace(/^0x/i, "")) : "";
      items.push({
        blockHeight: block.height,
        txIndex: i,
        timestamp: block.timestamp ?? null,
        txId: txIdRaw || null,
        sender: asAccount64(tx.sender),
        kind: getTxPayloadKind(tx.payload),
        summary:
          receipt?.success === false
            ? `${getTxPayloadSummary(tx.payload, block.height)} · failed, nothing transferred`
            : getTxPayloadSummary(tx.payload, block.height),
        roles,
        failed: receipt?.success === false,
      });
    }
  }

  items.sort((a, b) => b.blockHeight - a.blockHeight || b.txIndex - a.txIndex);
  return items;
}

export function accountTxRoleLabel(role: AccountTxRole): string {
  switch (role) {
    case "sender":
      return "Sent";
    case "recipient":
      return "Received";
    case "contract":
      return "Contract";
    case "created":
      return "Created";
    case "access_list":
      return "Access list";
    default:
      return role;
  }
}

/** Indexed `boing_getAccountTransactions` row (snake_case payload summary, no full calldata). */
export type IndexedAccountTxRow = {
  tx_id?: string;
  block_height?: number;
  tx_index?: number;
  timestamp?: number;
  sender?: string;
  roles?: string[];
  payload?: {
    kind?: string;
    to?: string;
    amount?: string;
    contract?: string;
    calldata_len?: number;
    steps?: Array<{ kind?: string; to?: string; amount?: string; contract?: string; calldata_len?: number }>;
  };
  success?: boolean | null;
};

function mapIndexedKind(kind: string | undefined): TxPayloadKind {
  const raw = (kind ?? "").trim();
  if (!raw) return "Unknown";
  // Reuse tagged catalog (PascalCase + snake_case) so indexer rows stay aligned with SDK variants.
  return resolveTaggedPayloadKind(raw) ?? "Unknown";
}

function mapIndexedRoles(raw: string[] | undefined): AccountTxRole[] {
  const out: AccountTxRole[] = [];
  for (const r of raw ?? []) {
    const k = r.toLowerCase();
    if (k === "sender" || k === "signer") out.push("sender");
    else if (k === "recipient" || k === "to") out.push("recipient");
    else if (k === "contract" || k === "counterparty" || k === "called_contract") out.push("contract");
    else if (k === "created" || k === "deployed") out.push("created");
    else if (k === "access_list") out.push("access_list");
  }
  return [...new Set(out)];
}

function summaryFromIndexedPayload(payload: IndexedAccountTxRow["payload"]): string {
  if (!payload?.kind) return "Transaction";
  const kind = payload.kind.toLowerCase();
  if (kind === "transfer") {
    const amt = payload.amount != null ? String(payload.amount) : "?";
    return `Transfer ${amt}`;
  }
  if (kind === "contract_call" || kind === "contract_call_with_value") {
    const len = payload.calldata_len;
    return len != null ? `Contract call (${len} bytes calldata)` : "Contract call";
  }
  if (kind === "batch") {
    const n = payload.steps?.length ?? 0;
    const tokenSteps = (payload.steps ?? []).filter((s) =>
      String(s.kind ?? "").toLowerCase().includes("contract"),
    ).length;
    return tokenSteps > 0
      ? `Batch · ${n} step${n === 1 ? "" : "s"} (${tokenSteps} contract call${tokenSteps === 1 ? "" : "s"})`
      : `Batch · ${n} step${n === 1 ? "" : "s"}`;
  }
  if (kind.includes("deploy")) return "Contract deploy";
  return payload.kind;
}

/** Map node-indexed account txs into the explorer history row shape. */
export function collectIndexedAccountTxHistory(
  rows: IndexedAccountTxRow[],
  opts: { minHeight?: number } = {},
): AccountTxHistoryItem[] {
  const minHeight = opts.minHeight ?? 0;
  const items: AccountTxHistoryItem[] = [];
  for (const row of rows) {
    const blockHeight = row.block_height;
    if (blockHeight == null || blockHeight < minHeight) continue;
    const roles = mapIndexedRoles(row.roles);
    if (!roles.length) {
      // Indexed rows for token accounts often only list "counterparty"; still show the row.
      roles.push("contract");
    }
    const txId = typeof row.tx_id === "string" ? normalizeHex64(row.tx_id.replace(/^0x/i, "")) : "";
    items.push({
      blockHeight,
      txIndex: typeof row.tx_index === "number" ? row.tx_index : 0,
      timestamp: typeof row.timestamp === "number" ? row.timestamp : null,
      txId: txId || null,
      sender: asAccount64(row.sender),
      kind: mapIndexedKind(row.payload?.kind),
      summary:
        row.success === false
          ? `${summaryFromIndexedPayload(row.payload)} · failed, nothing transferred`
          : summaryFromIndexedPayload(row.payload),
      roles,
      failed: row.success === false,
    });
  }
  items.sort((a, b) => b.blockHeight - a.blockHeight || b.txIndex - a.txIndex);
  return items;
}
