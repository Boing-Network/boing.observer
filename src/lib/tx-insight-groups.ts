/**
 * Group consecutive same-objective transactions for multi-tx views (block pages).
 * Same kind + same signer collapse into one section; different kinds stay separate.
 */
import type { BlockTransaction, TransactionReceipt, TxPayloadKind } from "./rpc-types";
import { hexForLink } from "./rpc-types";
import { getTxPayloadKind } from "./tx-payload";

export type TxInsightSlot = {
  index: number;
  tx: BlockTransaction;
  receipt: TransactionReceipt | null | undefined;
};

export type TxInsightGroup = {
  kind: TxPayloadKind;
  /** Lowercase 64-hex signer, or "" when unknown. */
  signer: string;
  items: TxInsightSlot[];
};

function signerKey(tx: BlockTransaction): string {
  return (hexForLink(tx.sender) || "").toLowerCase();
}

/**
 * Walk txs in order; merge consecutive slots that share payload kind and signer.
 * Singleton groups keep the existing full-card UX; multi-item groups use a compact list.
 */
export function groupTxInsights(
  txs: BlockTransaction[],
  receipts: Array<TransactionReceipt | null | undefined> | null | undefined,
): TxInsightGroup[] {
  const groups: TxInsightGroup[] = [];
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]!;
    const kind = getTxPayloadKind(tx.payload);
    const signer = signerKey(tx);
    const slot: TxInsightSlot = {
      index: i,
      tx,
      receipt: Array.isArray(receipts) ? receipts[i] : undefined,
    };
    const prev = groups[groups.length - 1];
    if (prev && prev.kind === kind && prev.signer === signer && kind !== "Unknown") {
      prev.items.push(slot);
    } else {
      groups.push({ kind, signer, items: [slot] });
    }
  }
  return groups;
}
