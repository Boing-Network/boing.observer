"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getNativeUnitConfig,
  subscribeNativeUnitConfig,
  type NativeUnitConfig,
} from "@/lib/native-unit-config";
import { loadNativeUnitConfig } from "@/lib/native-unit-live";
import type { NetworkId } from "@/lib/rpc-types";

/**
 * Keeps the native-unit registry (denomination switch height, gas price, execution-gas bps) in sync with the
 * node and re-renders the caller when it changes. Call once near the top of any page that formats native
 * amounts across block heights or estimates fees; children re-render with the page.
 *
 * Until the first response (or when the node is old / unreachable) the returned config is the fallback and
 * `source` is `"fallback"`, so UIs can label estimates honestly.
 */
export function useNativeUnitConfig(network: NetworkId): NativeUnitConfig {
  useEffect(() => {
    void loadNativeUnitConfig(network);
  }, [network]);
  return useSyncExternalStore(
    subscribeNativeUnitConfig,
    () => getNativeUnitConfig(network),
    // Server render: the registry is only filled client-side, so this is the stable fallback.
    () => getNativeUnitConfig(network),
  );
}