import { tryPredictDeployedContractAddressFromDeployTx } from "@/lib/deploy-contract-address";
import { receiptReturnDataHex, tryParseCreatedAccountIdFromDeployReturnData } from "@/lib/deploy-receipt";
import { hexForLink, normalizeHex64 } from "@/lib/rpc-types";
import type { TxPayloadKind } from "@/lib/rpc-types";
import {
  getTxPayloadInner,
  getTxPayloadKind,
  getTxPayloadSummary,
  isContractDeployPayloadKind,
} from "@/lib/tx-payload";

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
        summary: getTxPayloadSummary(tx.payload),
        roles,
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
