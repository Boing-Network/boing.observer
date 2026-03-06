"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { isMainnetConfigured } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";

const STORAGE_KEY = "boing-explorer-network";

function normalizeNetwork(value: string | null): NetworkId {
  if (value === "mainnet" && isMainnetConfigured()) return "mainnet";
  return "testnet";
}

type NetworkContextValue = {
  network: NetworkId;
  setNetwork: (n: NetworkId) => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<NetworkId>("testnet");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as NetworkId | null;
      setNetworkState(normalizeNetwork(stored));
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const setNetwork = useCallback((n: NetworkId) => {
    const next = normalizeNetwork(n);
    setNetworkState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // Sync from URL searchParams on mount (e.g. ?network=mainnet)
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const n = params.get("network");
    if (n === "mainnet" || n === "testnet") setNetwork(normalizeNetwork(n));
  }, [mounted, setNetwork]);

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
