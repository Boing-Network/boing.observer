"use client";

import { useCallback, useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { fetchBlockByHeight, fetchChainHeight } from "@/lib/rpc-methods";

/** The banner appears when the newest block is older than this. */
export const STALE_AFTER_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 60_000;
const DISMISS_KEY = "boing-observer:stale-tip-dismissed";

export function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ${mins % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}

/**
 * Warns when the public testnet has stopped producing blocks. Uses the same RPC and cache as the rest of the
 * explorer. Shows nothing if the RPC is unreachable (the RPC-unreachable banner covers that), and says nothing
 * about mainnet. Dismissal is remembered per tip height for the browser session.
 */
export function ChainStaleBanner() {
  const { network } = useNetwork();
  const [tip, setTip] = useState<{ height: number; ageMs: number } | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedAt(window.sessionStorage.getItem(DISMISS_KEY));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const check = useCallback(async () => {
    if (network !== "testnet") {
      setTip(null);
      return;
    }
    try {
      const height = await fetchChainHeight(network);
      const block = await fetchBlockByHeight(network, height);
      const ts = Number(block?.header?.timestamp);
      if (!Number.isFinite(ts) || ts <= 0) {
        setTip(null);
        return;
      }
      setTip({ height, ageMs: Date.now() - ts * 1000 });
    } catch {
      setTip(null);
    }
  }, [network]);

  useEffect(() => {
    void check();
  }, [check]);

  useVisibleInterval(() => void check(), CHECK_INTERVAL_MS);

  if (!tip || tip.ageMs < STALE_AFTER_MS || dismissedAt === String(tip.height)) return null;

  return (
    <div
      role="status"
      data-testid="chain-stale-banner"
      className="flex items-start justify-center gap-3 border-b border-amber-500/40 bg-amber-950/30 px-3 py-2.5 text-center text-xs text-amber-200 sm:px-4 sm:text-sm"
    >
      <p className="m-0 leading-snug">
        <strong>Testnet block production looks stalled</strong> — last block {formatAge(tip.ageMs)} ago (height{" "}
        {tip.height.toLocaleString()}). Data shown here may be out of date.
      </p>
      <button
        type="button"
        aria-label="Dismiss stalled-testnet notice"
        className="-my-1 min-h-[44px] min-w-[44px] shrink-0 rounded-md text-amber-100 underline underline-offset-2 hover:text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
        onClick={() => {
          try {
            window.sessionStorage.setItem(DISMISS_KEY, String(tip.height));
          } catch {
            /* ignore */
          }
          setDismissedAt(String(tip.height));
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
