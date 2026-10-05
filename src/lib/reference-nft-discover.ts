import "server-only";

import type { BoingClient } from "boing-sdk";
import { fetchBlocksWithReceiptsForHeightRange, validateHex32 } from "boing-sdk";
import {
  decodeReferenceNftCalldata,
  tokenIdsFromDecodedReferenceNftCall,
} from "@/lib/reference-nft-calldata";
import { normalizeHex64 } from "@/lib/rpc-types";
import { getTxPayloadInner, getTxPayloadKind } from "@/lib/tx-payload";

/**
 * Scan a height window for ContractCalls to `collectionHex` and collect reference NFT
 * token-id words from mint_batch / transfer_nft / set_metadata_hash calldata.
 * Needed for FreshMint-style opaque (hash) token ids that sequential probes miss.
 */
export async function discoverReferenceNftTokenIdsFromHeightRange(
  client: BoingClient,
  collectionHex: string,
  fromHeight: number,
  toHeight: number,
  options?: { maxConcurrent?: number; maxTokenIds?: number },
): Promise<{ tokenIdWords: string[]; mintTxIdsByTokenId: Record<string, string> }> {
  const want = validateHex32(collectionHex).replace(/^0x/i, "").toLowerCase();
  const maxTokenIds = Math.min(200, Math.max(1, options?.maxTokenIds ?? 64));
  const found = new Set<string>();
  const mintTxIdsByTokenId: Record<string, string> = {};

  const bundles = await fetchBlocksWithReceiptsForHeightRange(client, fromHeight, toHeight, {
    maxConcurrent: options?.maxConcurrent ?? 8,
    onMissingBlock: "omit",
  });

  for (const bundle of bundles) {
    const txs = (bundle.block.transactions ?? []) as Array<{ payload?: unknown }>;
    const receipts = (bundle.block.receipts ?? []) as Array<{ tx_id?: unknown; success?: unknown } | null>;

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (!tx || tx.payload === undefined) continue;
      const receipt = receipts[i] ?? null;
      if (receipt && receipt.success === false) continue;

      const kind = getTxPayloadKind(tx.payload);
      if (kind !== "ContractCall") continue;
      const inner = getTxPayloadInner(tx.payload);
      const contractRaw = typeof inner.contract === "string" ? inner.contract : "";
      const contract = normalizeHex64(contractRaw.replace(/^0x/i, ""));
      if (!contract || contract !== want) continue;
      const calldata = typeof inner.calldata === "string" ? inner.calldata : "";
      if (!calldata) continue;
      const decoded = decodeReferenceNftCalldata(calldata);
      if (!decoded) continue;

      const txId =
        receipt && typeof receipt.tx_id === "string"
          ? normalizeHex64(String(receipt.tx_id).replace(/^0x/i, ""))
          : null;

      for (const id of tokenIdsFromDecodedReferenceNftCall(decoded)) {
        const id64 = normalizeHex64(id.replace(/^0x/i, ""));
        if (!id64 || found.has(id64)) continue;
        found.add(id64);
        if (txId && !mintTxIdsByTokenId[id64]) mintTxIdsByTokenId[id64] = txId;
        if (found.size >= maxTokenIds) {
          return { tokenIdWords: [...found], mintTxIdsByTokenId };
        }
      }
    }
  }

  return { tokenIdWords: [...found], mintTxIdsByTokenId };
}
