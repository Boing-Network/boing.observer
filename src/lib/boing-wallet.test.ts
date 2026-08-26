import { describe, expect, it } from "vitest";
import {
  chainIdHexForNetwork,
  firstAccountHex,
  isQaPoolVoteUnsupported,
  isWalletUserRejected,
  mapWalletErrorToUi,
  qaPoolVoteTxRequest,
} from "./boing-wallet";

describe("boing-wallet helpers", () => {
  it("maps chain ids", () => {
    expect(chainIdHexForNetwork("testnet")).toBe("0x1b01");
    expect(chainIdHexForNetwork("mainnet")).toBe("0x1b02");
  });

  it("builds qa_pool_vote dApp JSON", () => {
    const subject = "03".repeat(32);
    expect(qaPoolVoteTxRequest(`0x${subject}`, "allow")).toEqual({
      type: "qa_pool_vote",
      subject: `0x${subject}`,
      vote: "allow",
    });
  });

  it("takes the first valid account", () => {
    expect(firstAccountHex([])).toBeNull();
    expect(firstAccountHex(["0x" + "ab".repeat(32)])).toBe("ab".repeat(32));
  });

  it("maps wallet errors", () => {
    expect(isWalletUserRejected({ code: 4001, message: "User rejected" })).toBe(true);
    expect(isQaPoolVoteUnsupported(new Error("Unsupported transaction type: qa_pool_vote"))).toBe(
      true
    );
    expect(mapWalletErrorToUi({ code: 4001, message: "User rejected the request" })).toMatch(
      /cancelled/
    );
    expect(
      mapWalletErrorToUi(new Error("Unsupported transaction type: qa_pool_vote"))
    ).toMatch(/Update the wallet/);
  });
});
