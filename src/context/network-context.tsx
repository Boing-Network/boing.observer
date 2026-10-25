"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { isMainnetConfigured } from "@/lib/rpc-client";
import { NETWORK_STORAGE_KEY, resolveInitialNetwork, syncNetworkInSearch } from "@/lib/network-param";
import type { NetworkId } from "@/lib/rpc-types";

type NetworkContextValue = {
  network: NetworkId;
  setNetwork: (n: NetworkId) => void;
  /**
   * False until the first client effect has resolved `?network=` / the stored preference. Pages that fetch chain data
   * must wait for it, otherwise a mainnet deep link would first query testnet.
   */
  ready: boolean;
  /** A deep link asked for a network this deployment cannot serve (e.g. mainnet before it is configured). */
  unavailableRequested: NetworkId | null;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<NetworkId>("testnet");
  const [ready, setReady] = useState(false);
  const [unavailableRequested, setUnavailableRequested] = useState<NetworkId | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(NETWORK_STORAGE_KEY);
    } catch {
      // ignore
    }
    const r = resolveInitialNetwork({
      search: window.location.search,
      stored,
      mainnetConfigured: isMainnetConfigured(),
    });
    setNetworkState(r.network);
    setUnavailableRequested(r.unavailable);
    if (r.source === "url" && !r.unavailable) {
      try {
        localStorage.setItem(NETWORK_STORAGE_KEY, r.network);
      } catch {
        // ignore
      }
    }
    setReady(true);
  }, []);

  const setNetwork = useCallback((n: NetworkId) => {
    const next: NetworkId = n === "mainnet" && isMainnetConfigured() ? "mainnet" : "testnet";
    setNetworkState(next);
    setUnavailableRequested(null);
    try {
      localStorage.setItem(NETWORK_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    // Keep a shared / bookmarked URL truthful after the user switches networks.
    try {
      const nextSearch = syncNetworkInSearch(window.location.search, next);
      if (nextSearch !== null) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${nextSearch}${window.location.hash}`);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ network, setNetwork, ready, unavailableRequested }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}