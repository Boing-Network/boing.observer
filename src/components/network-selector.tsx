"use client";

import { useNetwork } from "@/context/network-context";
import { boingChainIdLabel, boingNetworkId } from "@/lib/chain-ids";
import { isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

export function NetworkSelector() {
  const { network, setNetwork } = useNetwork();
  const mainnetConfigured = isMainnetConfigured();

  return (
    <div className="flex flex-col items-end gap-0.5 rounded-lg border border-[var(--border-color)] bg-boing-navy/80 px-3 py-1.5 sm:flex-row sm:items-center sm:gap-2">
      <div className="flex items-center gap-2">
        <label
          htmlFor="network-selector"
          className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]"
        >
          Network
        </label>
        <select
          id="network-selector"
          name="network"
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
      <span
        className="hidden text-[0.65rem] font-mono text-[var(--text-secondary)] tabular-nums lg:block lg:border-l lg:border-[var(--border-color)] lg:pl-2"
        title={`${boingNetworkId(network)} — chain ID for dApps (Boing Express / boing.finance); not returned by block RPC.`}
      >
        Chain {boingChainIdLabel(network)}
      </span>
    </div>
  );
}
