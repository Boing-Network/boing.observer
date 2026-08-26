import { describe, expect, it } from "vitest";
import { collectAccountTxHistory, rolesForAccountInTx } from "./account-tx-history";

const WALLET = "a".repeat(64);
const OTHER = "b".repeat(64);
const CONTRACT = "c".repeat(64);

describe("rolesForAccountInTx", () => {
  it("marks the signer as sender", () => {
    expect(
      rolesForAccountInTx(WALLET, {
        sender: `0x${WALLET}`,
        payload: { Transfer: { to: `0x${OTHER}`, amount: "1" } },
      }),
    ).toEqual(["sender"]);
  });

  it("marks a transfer destination as recipient", () => {
    expect(
      rolesForAccountInTx(WALLET, {
        sender: `0x${OTHER}`,
        payload: { Transfer: { to: `0x${WALLET}`, amount: "9" } },
      }),
    ).toEqual(["recipient"]);
  });

  it("marks a called contract", () => {
    expect(
      rolesForAccountInTx(CONTRACT, {
        sender: `0x${WALLET}`,
        payload: { ContractCall: { contract: `0x${CONTRACT}`, calldata: "0x01" } },
      }),
    ).toEqual(["contract"]);
  });

  it("marks access-list accounts that are not the signer or called contract", () => {
    expect(
      rolesForAccountInTx(WALLET, {
        sender: `0x${OTHER}`,
        payload: { ContractCall: { contract: `0x${CONTRACT}`, calldata: "0x01" } },
        access_list: { read: [`0x${WALLET}`], write: [] },
      }),
    ).toEqual(["access_list"]);
  });

  it("does not add access_list when the account is already the signer or recipient", () => {
    expect(
      rolesForAccountInTx(WALLET, {
        sender: `0x${WALLET}`,
        payload: { Bond: { amount: "1" } },
        access_list: { write: [`0x${WALLET}`] },
      }),
    ).toEqual(["sender"]);
    expect(
      rolesForAccountInTx(WALLET, {
        sender: `0x${OTHER}`,
        payload: { Transfer: { to: `0x${WALLET}`, amount: "9" } },
        access_list: { write: [`0x${WALLET}`] },
      }),
    ).toEqual(["recipient"]);
  });

  it("marks created account from deploy return data", () => {
    expect(
      rolesForAccountInTx(WALLET, {
        sender: `0x${OTHER}`,
        nonce: 0,
        payload: { ContractDeployWithPurpose: { bytecode: "0xaa", purpose_category: "token" } },
      }, { success: true, return_data: `0x${WALLET}` }),
    ).toEqual(["created"]);
  });
});

describe("collectAccountTxHistory", () => {
  it("returns matching txs newest first and skips unrelated txs", () => {
    const items = collectAccountTxHistory(WALLET, [
      {
        height: 3,
        timestamp: 100,
        transactions: [
          { sender: `0x${OTHER}`, payload: { Transfer: { to: `0x${OTHER}`, amount: "1" } } },
          {
            sender: `0x${OTHER}`,
            payload: { Transfer: { to: `0x${WALLET}`, amount: "2" } },
          },
        ],
        receipts: [null, { tx_id: `0x${"d".repeat(64)}` }],
      },
      {
        height: 9,
        timestamp: 200,
        transactions: [{ sender: `0x${WALLET}`, payload: { Bond: { amount: "3" } } }],
      },
    ]);
    expect(items.map((row) => [row.blockHeight, row.txIndex, row.roles[0], row.txId])).toEqual([
      [9, 0, "sender", null],
      [3, 1, "recipient", "d".repeat(64)],
    ]);
  });
});
