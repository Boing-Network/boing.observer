import { deriveNativeUnitConfig, setNativeUnitConfig, type NativeUnitConfig } from "./native-unit-config";
import { fetchNetworkInfo, tryFetchNetworkFeePolicy } from "./rpc-methods";
import type { NetworkId } from "./rpc-types";

/**
 * Load `boing_getNetworkInfo.native_currency` + `boing_getNetworkFeePolicy` (both cached in `rpc-methods`) and
 * publish the result to the native-unit registry. Never throws: on any failure the registry keeps whatever it
 * had (fallback constants on first load), so fee estimates degrade to the previous hard-coded behaviour.
 */
export async function loadNativeUnitConfig(network: NetworkId): Promise<NativeUnitConfig | null> {
  const [info, policy] = await Promise.allSettled([fetchNetworkInfo(network), tryFetchNetworkFeePolicy(network)]);
  const infoV = info.status === "fulfilled" ? info.value : null;
  const policyV = policy.status === "fulfilled" ? policy.value : null;
  if (!infoV && !policyV) return null;
  const cfg = deriveNativeUnitConfig(network, infoV, policyV);
  setNativeUnitConfig(network, cfg);
  return cfg;
}