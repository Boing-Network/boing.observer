import { describe, expect, it } from "vitest";
import { EMPTY_DECODE_CONTEXT, decodeContractCall, describeDecodedCall, segmentsToText } from "./tx-decode";
import { knownBytecodeMap } from "./contract-identify";
import { matchInterfaceBySelectors } from "./contract-interfaces";
import {
  REFERENCE_MULTI_TOKEN_RUNTIME_HEX,
  encodeMultiTokenMintBatchCalldata,
  encodeMultiTokenTransferCalldata,
} from "./reference-multi-token";

const C = "cc".repeat(32);
const A = "a1".repeat(32);
const B = "b2".repeat(32);
const hex = (b: Uint8Array) => "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const ctx = { ...EMPTY_DECODE_CONTEXT, interfaceId: "multi-token" };

describe("multi-token identify + tx decode", () => {
  it("identifies the pinned runtime", () => {
    expect(knownBytecodeMap().get(REFERENCE_MULTI_TOKEN_RUNTIME_HEX)?.interfaceId).toBe("multi-token");
    expect(matchInterfaceBySelectors([0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29])?.id).toBe("multi-token");
  });

  it("describes a transfer", () => {
    const call = decodeContractCall({ contract: C, calldata: hex(encodeMultiTokenTransferCalldata(B, 1, 40)), interfaceId: "multi-token" })!;
    expect(call.fn.name).toBe("transfer");
    const d = describeDecodedCall(call, { sender: A, receipt: { success: true }, ctx });
    expect(d.title).toBe("Send game items");
    expect(segmentsToText(d.headline)).toMatch(/^Sent 40 × item #1 to 0x/);
  });

  it("describes a batch mint", () => {
    const cd = encodeMultiTokenMintBatchCalldata(A, [
      { itemId: 2, amount: 25 },
      { itemId: 3, amount: 7 },
    ]);
    const call = decodeContractCall({ contract: C, calldata: hex(cd), interfaceId: "multi-token" })!;
    expect(call.items).toEqual([
      { itemId: BigInt(2), amount: BigInt(25) },
      { itemId: BigInt(3), amount: BigInt(7) },
    ]);
    const d = describeDecodedCall(call, { sender: A, receipt: { success: true }, ctx });
    expect(segmentsToText(d.headline)).toMatch(/^Minted 25 × item #2, 7 × item #3 to 0x/);
  });
});
