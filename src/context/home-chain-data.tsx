"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNetwork } from "@/context/network-context";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { fetchRecentBlocks } from "@/lib/rpc-methods";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import type { Block } from "@/lib/rpc-types";

/** Max window among home widgets (economy insights). */
export const HOME_BLOCK_WINDOW = 40;

/**
 * Stats cadence: shared provider refreshes at this rate so all home widgets
 * derive from one tip + block window instead of overlapping independent polls.
 */
export const HOME_REFRESH_MS = 15_000;

type HomeChainDataValue = {
  tipHeight: number | null;
  /** Newest-first valid blocks (up to HOME_BLOCK_WINDOW). */
  blocks: Block[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  sliceBlocks: (count: number) => Block[];
};

const HomeChainDataContext = createContext<HomeChainDataValue | null>(null);

export function HomeChainDataProvider({ children }: { children: ReactNode }) {
  const { network } = useNetwork();
  const [tipHeight, setTipHeight] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      setError(null);
      if (isRefresh) setRefreshing(true);
      try {
        const { height, blocks: next } = await fetchRecentBlocks(network, HOME_BLOCK_WINDOW);
        setTipHeight(height);
        setBlocks(next);
      } catch (e) {
        setError(getFriendlyRpcErrorMessage(e, network, "stats"));
        if (!isRefresh) {
          setTipHeight(null);
          setBlocks([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [network]
  );

  useEffect(() => {
    setLoading(true);
    void load(false);
  }, [load]);

  useVisibleInterval(() => void load(true), HOME_REFRESH_MS);

  const hasData = tipHeight != null || blocks.length > 0;

  const sliceBlocks = useCallback(
    (count: number) => blocks.slice(0, Math.max(0, count)),
    [blocks]
  );

  const value = useMemo<HomeChainDataValue>(
    () => ({
      tipHeight,
      blocks,
      loading: loading && !hasData,
      refreshing,
      error,
      sliceBlocks,
    }),
    [tipHeight, blocks, loading, hasData, refreshing, error, sliceBlocks]
  );

  return (
    <HomeChainDataContext.Provider value={value}>{children}</HomeChainDataContext.Provider>
  );
}

export function useHomeChainData(): HomeChainDataValue {
  const ctx = useContext(HomeChainDataContext);
  if (!ctx) {
    throw new Error("useHomeChainData must be used within HomeChainDataProvider");
  }
  return ctx;
}
