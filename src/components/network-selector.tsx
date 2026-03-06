"use client";

import { useNetwork } from "@/context/network-context";
import { isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

export function NetworkSelector() {
  const { network, setNetwork } = useNetwork();
  const mainnetConfigured = isMainnetConfigured();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-boing-navy/80 px-3 py-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Network
      </span>
      <select
        value={network}
        onChange={(e) => setNetwork(e.target.value as NetworkId)}
        className="bg-transparent font-display text-sm font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-network-primary rounded px-2 py-0.5 cursor-pointer"
        aria-label="Select network"
      >
        <option value="testnet">Testnet</option>
        <option value="mainnet" disabled={!mainnetConfigured}>
          {mainnetConfigured ? "Mainnet" : "Mainnet (coming soon)"}
        </option>
      </select>
    </div>
  );
}
