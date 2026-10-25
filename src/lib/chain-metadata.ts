/**
 * Static chain identity, vendored from boing.network `docs/chain-metadata.json` (schema_version 1).
 *
 * The file is the cross-repo contract for wallets, explorers and indexers: chain ids, native currency,
 * explorer / wallet / faucet URLs. Live values (head height, fee policy, denomination heights) always
 * come from the node (`boing_getNetworkInfo` / `boing_health`), never from here.
 *
 * Refresh with `npm run sync:chain-metadata`; `chain-metadata.test.ts` fails when this app's constants drift
 * from the file, or (with a sibling boing.network checkout) when the vendored copy drifts from upstream.
 */
import raw from "../data/chain-metadata.json";
import type { NetworkId } from "./rpc-types";

/** The only `schema_version` this explorer understands. A bump upstream is a deliberate, reviewed upgrade. */
export const SUPPORTED_CHAIN_METADATA_SCHEMA = 1;

export interface ChainNetworkMeta {
  key: NetworkId;
  status: string;
  chain_id: number;
  chain_id_hex: string;
  chain_name: string;
  rpc_urls: string[];
  explorer_url: string;
  faucet_url: string | null;
  wallet_url: string;
  is_testnet: boolean;
  operator_requirements?: string;
}

export interface ChainMetadata {
  schema_version: number;
  description?: string;
  native_currency: {
    name: string;
    symbol: string;
    decimals: number;
    base_unit_decimals: number;
    base_units_per_boing: string;
    note?: string;
  };
  signing?: {
    address_format?: string;
    tx_signing_domain?: string;
    priority_tip_signing_domain?: string;
    golden_vectors?: string;
    encoding_spec?: string;
  };
  fee_policy?: { live_source?: string; doc?: string };
  discovery?: {
    rpc_spec?: string;
    rpc_openapi_path?: string;
    well_known_path?: string;
    client_hints?: string;
  };
  networks: ChainNetworkMeta[];
}

export const chainMetadata = raw as unknown as ChainMetadata;

export const NATIVE_CURRENCY = chainMetadata.native_currency;

/** Static identity for one network. Throws if the vendored file lacks it (caught by the drift test, never at runtime in a green build). */
export function networkMeta(network: NetworkId): ChainNetworkMeta {
  const meta = chainMetadata.networks.find((n) => n.key === network);
  if (!meta) throw new Error(`chain-metadata.json has no "${network}" network`);
  return meta;
}

/** `true` while the node-reported chain id agrees with the metadata for `network` (or the node omits it). */
export function chainIdMatches(network: NetworkId, reported: number | null | undefined): boolean {
  if (reported == null) return true;
  return networkMeta(network).chain_id === reported;
}