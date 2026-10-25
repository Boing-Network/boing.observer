import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NATIVE_CURRENCY,
  SUPPORTED_CHAIN_METADATA_SCHEMA,
  chainIdMatches,
  chainMetadata,
  networkMeta,
} from "./chain-metadata";
import {
  BOING_MAINNET_CHAIN_ID_DECIMAL,
  BOING_MAINNET_CHAIN_ID_HEX,
  BOING_MAINNET_NETWORK_ID,
  BOING_TESTNET_CHAIN_ID_DECIMAL,
  BOING_TESTNET_CHAIN_ID_HEX,
  BOING_TESTNET_NETWORK_ID,
  boingChainIdLabel,
} from "./chain-ids";
import { BOING_DECIMALS, BASE_UNITS_PER_BOING } from "./native-unit";
import { NETWORK_FAUCET_URL, SITE_URL, WALLET_URL } from "./constants";

describe("vendored chain-metadata.json", () => {
  it("is a schema version this explorer understands", () => {
    expect(chainMetadata.schema_version).toBe(SUPPORTED_CHAIN_METADATA_SCHEMA);
  });

  it("describes exactly the testnet and mainnet networks", () => {
    expect(chainMetadata.networks.map((n) => n.key).sort()).toEqual(["mainnet", "testnet"]);
    for (const n of chainMetadata.networks) {
      expect(n.chain_id_hex).toBe(`0x${n.chain_id.toString(16)}`);
      expect(n.rpc_urls.every((u) => u.startsWith("https://"))).toBe(true);
    }
    expect(networkMeta("testnet").is_testnet).toBe(true);
    expect(networkMeta("mainnet").is_testnet).toBe(false);
  });

  it("agrees with the chain ids this app exposes", () => {
    expect(BOING_TESTNET_CHAIN_ID_DECIMAL).toBe(6913);
    expect(BOING_TESTNET_CHAIN_ID_HEX).toBe("0x1b01");
    expect(BOING_MAINNET_CHAIN_ID_DECIMAL).toBe(6914);
    expect(BOING_MAINNET_CHAIN_ID_HEX).toBe("0x1b02");
    expect(BOING_TESTNET_NETWORK_ID).toBe(`boing-${networkMeta("testnet").key}`);
    expect(BOING_MAINNET_NETWORK_ID).toBe(`boing-${networkMeta("mainnet").key}`);
    expect(boingChainIdLabel("testnet")).toContain("6913");
  });

  it("agrees with the explorer, wallet and faucet URLs this app links to", () => {
    for (const n of chainMetadata.networks) {
      expect(n.explorer_url).toBe(SITE_URL);
      expect(n.wallet_url).toBe(WALLET_URL);
    }
    expect(networkMeta("testnet").faucet_url).toBe(NETWORK_FAUCET_URL);
  });

  it("agrees with the native currency constants", () => {
    expect(NATIVE_CURRENCY.symbol).toBe("BOING");
    expect(NATIVE_CURRENCY.decimals).toBe(BOING_DECIMALS);
    expect(NATIVE_CURRENCY.base_unit_decimals).toBe(BOING_DECIMALS);
    expect(BigInt(NATIVE_CURRENCY.base_units_per_boing)).toBe(BASE_UNITS_PER_BOING);
  });

  it("chainIdMatches tolerates nodes that omit the chain id and flags a mismatch", () => {
    expect(chainIdMatches("testnet", undefined)).toBe(true);
    expect(chainIdMatches("testnet", null)).toBe(true);
    expect(chainIdMatches("testnet", 6913)).toBe(true);
    expect(chainIdMatches("testnet", 6914)).toBe(false);
    expect(chainIdMatches("mainnet", 6914)).toBe(true);
  });

  // Drift guard: only runs where a sibling boing.network checkout exists (local dev), skipped in CI.
  const upstream = resolve(__dirname, "../../../boing.network/docs/chain-metadata.json");
  it.skipIf(!existsSync(upstream))("matches the sibling boing.network checkout (run `npm run sync:chain-metadata`)", () => {
    const upstreamJson = JSON.parse(readFileSync(upstream, "utf8")) as unknown;
    expect(chainMetadata).toEqual(upstreamJson);
  });
});