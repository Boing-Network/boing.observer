"use client";

import { useNetwork } from "@/context/network-context";

/** Shown when a deep link (e.g. from Boing Express) targets a network this explorer cannot serve yet. */
export function NetworkLinkNotice() {
  const { unavailableRequested } = useNetwork();
  if (!unavailableRequested) return null;
  return (
    <div
      role="status"
      data-testid="network-link-notice"
      className="border-b border-amber-500/40 bg-amber-950/30 px-3 py-2 text-center text-xs text-amber-200 sm:px-4 sm:text-sm"
    >
      This link points to <strong>{unavailableRequested}</strong>, which is not available on this explorer yet. Showing
      testnet instead, so the item you opened may not exist here.
    </div>
  );
}