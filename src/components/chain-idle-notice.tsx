"use client";

import { useCallback, useEffect, useState } from "react";
import { useNetwork } from "@/context/network-context";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { fetchBlockByHeight, fetchChainHeight } from "@/lib/rpc-methods";

/** The notice appears when the newest block is older than this. */
export const IDLE_AFTER_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 60_000;
const DISMISS_KEY = "boing-observer:idle-tip-dismissed";

export function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ${mins % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}

/**
 * Neutral info line for an idle chain. The Boing node only produces a block when there are transactions to
 * include, so a tip that is hours old is normal on a quiet testnet and is NOT a fault. This is deliberately not a
 * warning. Real trouble (RPC unreachable or erroring) is reported by `NetworkStatusBanner`, so this component
 * stays silent on RPC errors. It says nothing about mainnet. Dismissal is remembered per tip height for the
 * browser session.
 */
export function ChainIdleNotice() {
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

  if (!tip || tip.ageMs < IDLE_AFTER_MS || dismissedAt === String(tip.height)) return null;

  return (
    <div
      role="status"
      data-testid="chain-idle-notice"
      className="flex items-start justify-center gap-3 border-b border-[var(--border-color)] bg-white/[0.03] px-3 py-2.5 text-center text-xs text-[var(--text-secondary)] sm:px-4 sm:text-sm"
    >
      <p className="m-0 leading-snug">
        <strong className="font-semibold text-[var(--text-primary)]">No transactions recently.</strong> The Boing
        testnet only produces a block when there are transactions to include. Last block {formatAge(tip.ageMs)} ago
        (height {tip.height.toLocaleString()}).
      </p>
      <button
        type="button"
        aria-label="Dismiss idle-chain notice"
        className="-my-1 min-h-[44px] min-w-[44px] shrink-0 rounded-md text-network-cyan underline underline-offset-2 hover:text-network-cyan-light focus:outline-none focus:ring-2 focus:ring-network-cyan"
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
