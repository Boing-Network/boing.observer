"use client";

import { useEffect, useState, useCallback } from "react";
import { useNetwork } from "@/context/network-context";
import { fetchChainHeight } from "@/lib/rpc-methods";
import { isRpcUnreachableError } from "@/lib/rpc-status";
import { QA_RPC_TWO_SURFACES_DOC_URL } from "@/lib/constants";

const CHECK_INTERVAL_MS = 30_000;

export function NetworkStatusBanner() {
  const { network } = useNetwork();
  const [unreachable, setUnreachable] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    try {
      await fetchChainHeight(network);
      setUnreachable(false);
    } catch (e) {
      setUnreachable(isRpcUnreachableError(e));
    }
  }, [network]);

  useEffect(() => {
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check]);

  if (unreachable !== true) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="border-b border-amber-500/40 bg-amber-950/30 px-3 py-3 text-center text-xs text-amber-200 sm:px-4 sm:text-sm"
    >
      <strong>RPC unreachable.</strong> The chain may be down or the browser blocked the request (e.g. CORS). This app
      uses the configured public RPC URL, not your local node — see{" "}
      <a
        href={QA_RPC_TWO_SURFACES_DOC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-amber-100 underline underline-offset-2 hover:text-amber-50"
      >
        alignment §2.1
      </a>
      .{" "}
      <a href="/about" className="font-medium text-amber-100 underline underline-offset-2 hover:text-amber-50">
        About
      </a>
    </div>
  );
}
