import { describe, expect, it } from "vitest";
import { groupTxInsights } from "./tx-insight-groups";
import type { BlockTransaction } from "./rpc-types";

const bytes = (hex: string) => Array.from({ length: 32 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
const FAUCET = "1e1a11f9eb0123456789abcdef0123456789abcdef0123456789ab62433615".slice(0, 64);
const OTHER = "d692627aae0123456789abcdef0123456789abcdef0123456789abcd3635237".slice(0, 64);
const TO_A = "65ae8eb5c30123456789abcdef0123456789abcdef0123456789abded85db1".slice(0, 64);
const TO_B = "4565ac618c0123456789abcdef0123456789abcdef0123456789ab6b86f849".slice(0, 64);

function transfer(sender: string, to: string, amount = "20000000000000000000"): BlockTransaction {
  return {
    sender: bytes(sender),
    nonce: 1,
    payload: { Transfer: { to: bytes(to), amount } },
    access_list: { read: [], write: [] },
  };
}

function bond(sender: string, amount = "1"): BlockTransaction {
  return {
    sender: bytes(sender),
    nonce: 1,
    payload: { Bond: { amount } },
    access_list: { read: [], write: [] },
  };
}

describe("groupTxInsights", () => {
  it("collapses consecutive same-kind same-signer transfers into one group", () => {
    const groups = groupTxInsights(
      [transfer(FAUCET, TO_A), transfer(FAUCET, TO_B)],
      [
        { success: true, gas_used: 21000, tx_id: `0x${"aa".repeat(32)}` },
        { success: true, gas_used: 21000, tx_id: `0x${"bb".repeat(32)}` },
      ],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe("Transfer");
    expect(groups[0]!.items.map((i) => i.index)).toEqual([0, 1]);
  });

  it("keeps different kinds separate", () => {
    const groups = groupTxInsights([transfer(FAUCET, TO_A), bond(FAUCET), transfer(FAUCET, TO_B)], null);
    expect(groups.map((g) => g.kind)).toEqual(["Transfer", "Bond", "Transfer"]);
    expect(groups.map((g) => g.items.length)).toEqual([1, 1, 1]);
  });

  it("does not merge same kind from different signers", () => {
    const groups = groupTxInsights([transfer(FAUCET, TO_A), transfer(OTHER, TO_B)], undefined);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.signer).not.toBe(groups[1]!.signer);
  });
});
