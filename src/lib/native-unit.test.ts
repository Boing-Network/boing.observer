import { describe, expect, it } from "vitest";
import {
  baseUnitsToChartNumber,
  compactBoing,
  compactBoingAt,
  feeBaseUnitsForGas,
  formatBoingAt,
  formatBoingBase,
  MICRO_FEE_EXECUTION_GAS_BPS,
  nativeDecimalsAt,
  toBaseUnits,
} from "./native-unit";

const B = BigInt("1000000000000000000");

describe("native BOING denomination", () => {
  it("testnet switches to base units at block 1050; mainnet is base units from genesis", () => {
    expect(nativeDecimalsAt(1049)).toBe(0);
    expect(nativeDecimalsAt(1050)).toBe(18);
    expect(nativeDecimalsAt(1, "mainnet")).toBe(18);
    expect(nativeDecimalsAt(undefined)).toBe(18);
  });
  it("normalizes amounts from both sides of the switch to base units", () => {
    expect(toBaseUnits("20", 1049)).toBe(BigInt(20) * B);
    expect(toBaseUnits((BigInt(20) * B).toString(), 1050)).toBe(BigInt(20) * B);
    expect(formatBoingAt("20", 10)).toBe("20");
    expect(formatBoingAt("20500000000000000000", 2000)).toBe("20.5");
    expect(toBaseUnits("abc", 1)).toBeNull();
  });
  it("formats compact and exact BOING", () => {
    expect(formatBoingBase(BigInt(1234567) * B)).toBe("1,234,567");
    expect(formatBoingBase(BigInt(1))).toBe("0.000000000000000001");
    expect(compactBoing(BigInt(1250000) * B).short).toBe("1.2M");
    expect(compactBoing(BigInt("21000000000000000")).short).toBe("0.021");
    expect(compactBoing(BigInt(1)).short).toBe("<0.0001");
    expect(compactBoing(BigInt(1)).full).toBe("0.000000000000000001");
    expect(compactBoingAt("1000000", 5).short).toBe("1M");
  });
  it("fees follow the rule at the height (micro BPS in base-units era)", () => {
    expect(feeBaseUnitsForGas(21000, 1000)).toBe(B);
    expect(feeBaseUnitsForGas(21001, 1000)).toBe(BigInt(2) * B);
    expect(MICRO_FEE_EXECUTION_GAS_BPS).toBe(100);
    expect(formatBoingBase(feeBaseUnitsForGas(21000, 1050))).toBe("0.00021");
    expect(formatBoingBase(feeBaseUnitsForGas(21000, 1050, null, 10_000))).toBe("0.021");
  });
  it("chart numbers are BOING floats", () => {
    expect(baseUnitsToChartNumber(BigInt(3) * B)).toBe(3);
    expect(baseUnitsToChartNumber(BigInt("21000000000000000"))).toBeCloseTo(0.021);
  });
});
