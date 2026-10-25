import { afterEach, describe, expect, it } from "vitest";
import {
  deriveNativeUnitConfig,
  fallbackNativeUnitConfig,
  getNativeUnitConfig,
  resetNativeUnitConfig,
  setNativeUnitConfig,
  subscribeNativeUnitConfig,
} from "./native-unit-config";
import { failedTxFeeBaseUnits } from "./failed-tx";
import { baseUnitsFromHeight, feeBaseUnitsForGas, formatBoingBase, nativeDecimalsAt, toBaseUnits } from "./native-unit";
import type { BoingNetworkFeePolicy } from "./rpc-types";

const B = BigInt("1000000000000000000");

function policy(over: Partial<BoingNetworkFeePolicy> = {}): BoingNetworkFeePolicy {
  return {
    fee_validators_bps: 7000,
    fee_treasury_bps: 2000,
    fee_burn_bps: 1000,
    execution_gas_fee_bps: 100,
    extra_fixed_fee: "0",
    transfer_amount_bps: 0,
    blob_base_fee_per_kib: "0",
    blob_forever_pin_fee_per_kib: "0",
    free_tx_min_balance: "0",
    tip_proposer_bps: 8000,
    tip_treasury_bps: 1000,
    tip_burn_bps: 1000,
    ...over,
  };
}

afterEach(() => resetNativeUnitConfig());

describe("native unit config (live fee policy / native_currency)", () => {
  it("falls back to the historical constants with source=fallback", () => {
    const cfg = getNativeUnitConfig("testnet");
    expect(cfg.source).toBe("fallback");
    expect(cfg.baseUnitsFromHeight).toBe(1050);
    expect(cfg.executionGasFeeBps).toBe(100);
    expect(getNativeUnitConfig("mainnet").baseUnitsFromHeight).toBe(0);
    // Stable reference (required by useSyncExternalStore).
    expect(getNativeUnitConfig("testnet")).toBe(getNativeUnitConfig("testnet"));
  });

  it("derives the denomination switch height and gas price from native_currency", () => {
    const cfg = deriveNativeUnitConfig("testnet", {
      native_currency: { base_units_from_height: 4000, gas_price_base_units: "2000000000000" },
    });
    expect(cfg.baseUnitsFromHeight).toBe(4000);
    expect(cfg.gasPriceBaseUnits).toBe(BigInt("2000000000000"));
    expect(cfg.source).toBe("live");
  });

  it("treats base_units_from_height null as base units from genesis", () => {
    const cfg = deriveNativeUnitConfig("testnet", {
      native_currency: { base_units_from_height: null as unknown as number },
    });
    expect(cfg.baseUnitsFromHeight).toBe(0);
  });

  it("ignores malformed fields and keeps the fallback", () => {
    const cfg = deriveNativeUnitConfig(
      "testnet",
      { native_currency: { base_units_from_height: -5, gas_price_base_units: "abc" } },
      policy({ execution_gas_fee_bps: Number.NaN, extra_fixed_fee: "x" }),
    );
    expect(cfg.baseUnitsFromHeight).toBe(1050);
    expect(cfg.executionGasFeeBps).toBe(100);
    expect(cfg.gasPriceBaseUnits).toBe(BigInt("1000000000000"));
    expect(cfg.extraFixedFee).toBe(BigInt(0));
    expect(cfg.source).toBe("fallback");
  });

  it("uses treasury.fee_policy from network info when the policy RPC is unavailable", () => {
    const cfg = deriveNativeUnitConfig("testnet", { treasury: { fee_policy: policy({ execution_gas_fee_bps: 250 }) } }, null);
    expect(cfg.executionGasFeeBps).toBe(250);
    expect(cfg.source).toBe("live");
  });

  it("drives fee estimates and the denomination switch through the helpers", () => {
    expect(formatBoingBase(feeBaseUnitsForGas(21000, 1050, "testnet"))).toBe("0.00021");

    setNativeUnitConfig(
      "testnet",
      deriveNativeUnitConfig(
        "testnet",
        { native_currency: { base_units_from_height: 200 } },
        policy({ execution_gas_fee_bps: 500, extra_fixed_fee: "1000" }),
      ),
    );
    expect(baseUnitsFromHeight("testnet")).toBe(200);
    expect(nativeDecimalsAt(199, "testnet")).toBe(0);
    expect(nativeDecimalsAt(200, "testnet")).toBe(18);
    // 21,000 gas x 1e12 x 5% + 1,000 fixed
    expect(feeBaseUnitsForGas(21000, 300, "testnet")).toBe(BigInt("1050000000000000") + BigInt(1000));
    // Whole-BOING era is unchanged by the policy.
    expect(feeBaseUnitsForGas(21000, 100, "testnet")).toBe(B);
    expect(toBaseUnits("20", 100, "testnet")).toBe(BigInt(20) * B);
    // Explicit override still wins.
    expect(feeBaseUnitsForGas(21000, 300, "testnet", 10_000)).toBe(BigInt("21000000000000000") + BigInt(1000));
    // Other network is untouched.
    expect(baseUnitsFromHeight("mainnet")).toBe(0);
  });

  it("failed-tx fee follows the live bps (waived policy = 0 fee in the base-unit era)", () => {
    setNativeUnitConfig("testnet", deriveNativeUnitConfig("testnet", null, policy({ execution_gas_fee_bps: 0 })));
    expect(failedTxFeeBaseUnits({ success: false, gas_used: 21000 } as never, 2000, "testnet")).toBe(BigInt(0));
  });

  it("notifies subscribers on change", () => {
    let n = 0;
    const off = subscribeNativeUnitConfig(() => {
      n += 1;
    });
    setNativeUnitConfig("testnet", fallbackNativeUnitConfig("testnet"));
    off();
    setNativeUnitConfig("testnet", fallbackNativeUnitConfig("testnet"));
    expect(n).toBe(1);
  });
});