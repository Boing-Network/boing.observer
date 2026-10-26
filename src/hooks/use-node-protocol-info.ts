"use client";

import { useEffect, useState } from "react";
import { fetchNetworkInfo } from "@/lib/rpc-methods";
import type { NetworkId } from "@/lib/rpc-types";
import { resolveReceiptRetention, type ReceiptRetention } from "@/lib/receipt-retention";
import { resolveStorageActivation, type StorageActivation } from "@/lib/storage-tree";

export interface NodeProtocolInfo {
  storageActivation: StorageActivation;
  receiptRetention: ReceiptRetention;
}

/**
 * Protocol facts that newer nodes publish in `boing_getNetworkInfo` (`storage_tree_v2_activation_height`,
 * `receipt_retention_blocks`). Before the node answers, or when it is older / unreachable, the build mirrors and
 * node defaults apply (see `storage-tree.ts` / `receipt-retention.ts`). Never throws.
 */
export function useNodeProtocolInfo(network: NetworkId, ready = true): NodeProtocolInfo {
  const [info, setInfo] = useState<unknown>(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setInfo(null);
    fetchNetworkInfo(network)
      .then((i) => {
        if (!cancelled) setInfo(i);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [network, ready]);
  return { storageActivation: resolveStorageActivation(info), receiptRetention: resolveReceiptRetention(info) };
}