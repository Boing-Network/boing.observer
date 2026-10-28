"use client";

import { useEffect, useMemo, useState } from "react";
import type { BlockTransaction, TransactionReceipt } from "@/lib/rpc-types";
import { hexForLink, normalizeHex64 } from "@/lib/rpc-types";
import { getTxPayloadInner, getTxPayloadKind } from "@/lib/tx-payload";
import { fetchTxContext } from "@/lib/tx-context-client";
import {
  decodeContractCall,
  describeDecodedCall,
  referencedIds,
  type DecodeContext,
  type TxDescription,
} from "@/lib/tx-decode";

/**
 * Human description of a ContractCall (token, amounts, sender / recipient, pool, router), or `null` while the
 * context loads and whenever the call is not understood (the caller then keeps the generic view).
 */
export function useTxDescription(
  tx: BlockTransaction,
  receipt: TransactionReceipt | null | undefined,
  network: string,
): TxDescription | null {
  const kind = getTxPayloadKind(tx.payload);
  const inner = getTxPayloadInner(tx.payload) as { contract?: unknown; calldata?: unknown };
  const contract = kind === "ContractCall" ? normalizeHex64(hexForLink(inner.contract)) : "";
  const calldata = typeof inner.calldata === "string" ? inner.calldata : "";
  const sender = normalizeHex64(hexForLink(tx.sender));
  const [loaded, setLoaded] = useState<{ ctx: DecodeContext; isPool: boolean } | null>(null);

  useEffect(() => {
    setLoaded(null);
    if (!contract || !calldata) return;
    let cancelled = false;
    const ids = referencedIds(calldata);
    void fetchTxContext(network, contract, ids).then((res) => {
      if (cancelled || !res) return;
      setLoaded({
        ctx: { interfaceId: res.contract?.interfaceId ?? null, tokens: res.tokens, pools: res.pools, labels: res.labels },
        isPool: res.contract?.isPool === true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [network, contract, calldata]);

  return useMemo(() => {
    if (!loaded || !contract || !calldata) return null;
    const { ctx, isPool } = loaded;
    const call = decodeContractCall({
      contract,
      calldata,
      interfaceId: ctx.interfaceId,
      isPool,
    });
    if (!call) return null;
    return describeDecodedCall(call, { sender, receipt: receipt ?? null, ctx });
  }, [loaded, contract, calldata, sender, receipt]);
}
