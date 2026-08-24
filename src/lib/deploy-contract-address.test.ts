import { describe, expect, it } from "vitest";
import { predictNonceDerivedContractAddress, validateHex32 } from "boing-sdk";
import { tryPredictDeployedContractAddressFromDeployTx } from "./deploy-contract-address";

describe("tryPredictDeployedContractAddressFromDeployTx", () => {
  it("matches SDK nonce-derived prediction for ContractDeploy", () => {
    const sender = validateHex32(`0x${"11".repeat(32)}`);
    const want = predictNonceDerivedContractAddress(sender, 0n).replace(/^0x/i, "").toLowerCase();
    const payload = { ContractDeploy: { bytecode: [1, 2, 3], create2_salt: null } };
    const addr = tryPredictDeployedContractAddressFromDeployTx(
      { sender, nonce: 0, payload },
      payload,
    );
    expect(addr).toBe(want);
  });

  it("accepts nonce as a decimal string (JSON-RPC u64 encoding)", () => {
    const sender = validateHex32(`0x${"11".repeat(32)}`);
    const want = predictNonceDerivedContractAddress(sender, 7n).replace(/^0x/i, "").toLowerCase();
    const payload = { ContractDeploy: { bytecode: [1, 2, 3], create2_salt: null } };
    const addr = tryPredictDeployedContractAddressFromDeployTx(
      { sender, nonce: "7", payload },
      payload,
    );
    expect(addr).toBe(want);
  });
});
