import {
  BOING_CUSTODY_ROUTER_BYTECODE_HEX,
  CANONICAL_BOING_TESTNET_BUILDER_ATTESTATION_REGISTRY_HEX,
  CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_AMM_LP_VAULT_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_DEX_FACTORY_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V1_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V2_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V3_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_DEX_MULTIHOP_SWAP_ROUTER_HEX,
  CANONICAL_BOING_TESTNET_NATIVE_LP_SHARE_TOKEN_HEX,
  DEFAULT_BUILDER_ATTESTATION_REGISTRY_BYTECODE_HEX,
  DEFAULT_LINKED_NFT_TOKEN_REGISTRY_BYTECODE_HEX,
  DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_BYTECODE_HEX,
  DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_V2_BYTECODE_HEX,
  DEFAULT_REFERENCE_NFT_COLLECTION_TEMPLATE_BYTECODE_HEX,
  boingPoolBytecodeHex,
  boingTokenBytecodeHex,
} from "boing-sdk";
import { decodeDispatchSelectors, hexToBytesLoose } from "./bytecode-selectors";
import {
  CONTRACT_INTERFACES,
  matchInterfaceBySelectors,
  type ContractFunction,
} from "./contract-interfaces";
import type { NetworkId } from "./rpc-types";

const h64 = (h: string) => h.replace(/^0x/i, "").toLowerCase();

type Known = { interfaceId: string; label: string };

/**
 * Canonical public-testnet deployments (boing-sdk `canonicalTestnet*.ts`). USDC, tBOING, the USDC/tBOING v9 pool,
 * the custody router and LP vault v2 are newer than the SDK build pinned here, so they are listed literally.
 */
export const CANONICAL_TESTNET_CONTRACTS: Record<string, Known> = {
  "6676f971ade3982406efa3e2cdb0477923f8f2a15624c4b6ad3a432817a75e93": { interfaceId: "fungible-v2", label: "USDC (canonical testnet token, reference fungible v2)" },
  "6fce9d3e3f13df9fc17e3fd947148a4e6ce6966538b7dd9bf2a891d3b9699c6b": { interfaceId: "fungible-v2", label: "tBOING (canonical testnet token, reference fungible v2)" },
  "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61": { interfaceId: "pool-custody", label: "USDC / tBOING pool (native CP pool v9)" },
  "806b2462b28f2f5772bbf5ae2628ad3a333bd2c5fa341144e0400ef5c2f1e4c6": { interfaceId: "custody-router", label: "Custody router v1 (canonical)" },
  "236a851dd50faaa268e2e1b7ba95cfb9993773abf63a4c0d949183d8302e65c7": { interfaceId: "lp-vault-v2", label: "LP vault v2 (canonical, USDC / tBOING pool)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_CP_POOL_HEX)]: { interfaceId: "pool-ledger", label: "Canonical native CP pool (ledger)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_DEX_FACTORY_HEX)]: { interfaceId: "dex-factory", label: "Native DEX factory (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V1_HEX)]: { interfaceId: "ledger-router", label: "Ledger router v1 (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V2_HEX)]: { interfaceId: "ledger-router", label: "Ledger router v2 (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_DEX_LEDGER_ROUTER_V3_HEX)]: { interfaceId: "ledger-router", label: "Ledger router v3 (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_DEX_MULTIHOP_SWAP_ROUTER_HEX)]: { interfaceId: "multihop-router", label: "Multihop swap router (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_AMM_LP_VAULT_HEX)]: { interfaceId: "lp-vault-v1", label: "Native AMM LP vault v1 (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_NATIVE_LP_SHARE_TOKEN_HEX)]: { interfaceId: "lp-share-token", label: "LP share token (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX)]: { interfaceId: "linked-nft-registry", label: "Linked NFT / token registry (canonical)" },
  [h64(CANONICAL_BOING_TESTNET_BUILDER_ATTESTATION_REGISTRY_HEX)]: { interfaceId: "builder-attestation", label: "Builder attestation registry (canonical)" },
};

let knownBytecodes: Map<string, Known> | null = null;

/** Canonical template bytecode (exact deploy bytes from boing-sdk) -> interface. */
export function knownBytecodeMap(): Map<string, Known> {
  if (knownBytecodes) return knownBytecodes;
  const m = new Map<string, Known>();
  const add = (hex: string, k: Known) => {
    const key = h64(hex);
    if (key && !m.has(key)) m.set(key, k);
  };
  add(boingTokenBytecodeHex(2), { interfaceId: "fungible-v2", label: "Reference fungible token v2 (canonical template)" });
  add(DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_V2_BYTECODE_HEX, { interfaceId: "fungible-v2", label: "Reference fungible token v2 (canonical template)" });
  add(boingTokenBytecodeHex(1), { interfaceId: "fungible-v1", label: "Reference fungible token v1 (canonical template)" });
  add(DEFAULT_REFERENCE_FUNGIBLE_TEMPLATE_BYTECODE_HEX, { interfaceId: "fungible-v1", label: "Reference fungible token v1 (canonical template)" });
  add(DEFAULT_REFERENCE_NFT_COLLECTION_TEMPLATE_BYTECODE_HEX, { interfaceId: "nft", label: "Reference NFT collection (canonical template)" });
  for (const v of [9, 8] as const) add(boingPoolBytecodeHex(v), { interfaceId: "pool-custody", label: `Native CP pool v${v} (canonical template)` });
  for (const v of [7, 6, 5, 4, 3, 2, 1] as const) add(boingPoolBytecodeHex(v), { interfaceId: "pool-ledger", label: `Native CP pool v${v} (canonical template)` });
  add(BOING_CUSTODY_ROUTER_BYTECODE_HEX, { interfaceId: "custody-router", label: "Custody router v1 (canonical template)" });
  add(DEFAULT_LINKED_NFT_TOKEN_REGISTRY_BYTECODE_HEX, { interfaceId: "linked-nft-registry", label: "Linked NFT / token registry (canonical template)" });
  add(DEFAULT_BUILDER_ATTESTATION_REGISTRY_BYTECODE_HEX, { interfaceId: "builder-attestation", label: "Builder attestation registry (canonical template)" });
  knownBytecodes = m;
  return m;
}

export type ContractCodeInfo = {
  bytecodeHex: string;
  deployer: string;
  height: number;
  txIndex: number;
};

export type IdentifiedContract = {
  address: string;
  /** How the interface was determined. */
  source: "canonical" | "bytecode" | "selectors" | "none";
  interfaceId: string | null;
  label: string | null;
  summary: string | null;
  docsUrl: string | null;
  functions: ContractFunction[];
  /** Selectors decoded from bytecode (empty when the bytecode was not found). */
  decodedSelectors: number[];
  /** Decoded selectors that no known interface describes. */
  unknownSelectors: number[];
  code: (Omit<ContractCodeInfo, "bytecodeHex"> & { sizeBytes: number }) | null;
  notes: string[];
};

export function identifyContract(input: {
  network: NetworkId;
  address64: string;
  code: ContractCodeInfo | null;
}): IdentifiedContract {
  const address = h64(input.address64);
  const notes: string[] = [];
  const canonical = input.network === "testnet" ? CANONICAL_TESTNET_CONTRACTS[address] : undefined;
  let decoded: number[] = [];
  let byCode: Known | undefined;
  if (input.code) {
    try {
      const bytes = hexToBytesLoose(input.code.bytecodeHex);
      decoded = decodeDispatchSelectors(bytes);
      byCode = knownBytecodeMap().get(h64(input.code.bytecodeHex));
    } catch {
      notes.push("Deploy bytecode could not be parsed.");
    }
  }

  let source: IdentifiedContract["source"] = "none";
  let known: Known | null = null;
  if (canonical) {
    source = "canonical";
    known = canonical;
  } else if (byCode) {
    source = "bytecode";
    known = byCode;
  } else if (decoded.length > 0) {
    const m = matchInterfaceBySelectors(decoded);
    if (m) {
      source = "selectors";
      known = {
        interfaceId: m.id,
        label: `${CONTRACT_INTERFACES[m.id]!.name}${m.exact ? "" : " (closest match)"}`,
      };
      notes.push("Matched by the selectors its bytecode dispatches on; parameter names come from the matching template.");
    }
  }

  const iface = known ? CONTRACT_INTERFACES[known.interfaceId] ?? null : null;
  let functions = iface?.functions ?? [];
  // When we only have a selector match, show just the selectors the bytecode really dispatches on.
  if (source === "selectors" && decoded.length > 0) {
    const have = new Set(decoded);
    functions = functions.filter((f) => have.has(f.selector));
  }
  const describedSet = new Set((iface?.functions ?? []).map((f) => f.selector));
  const unknownSelectors = decoded.filter((s) => !describedSet.has(s));

  return {
    address,
    source,
    interfaceId: iface?.id ?? null,
    label: known?.label ?? null,
    summary: iface?.summary ?? null,
    docsUrl: iface?.docsUrl ?? null,
    functions,
    decodedSelectors: decoded,
    unknownSelectors,
    code: input.code
      ? {
          deployer: input.code.deployer,
          height: input.code.height,
          txIndex: input.code.txIndex,
          sizeBytes: Math.floor(h64(input.code.bytecodeHex).length / 2),
        }
      : null,
    notes,
  };
}