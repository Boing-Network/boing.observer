import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/testnet-swap-blocks-1334-1335.json";
import vaultFixture from "./__fixtures__/testnet-vault-blocks-105-106.json";
import {
  calldataWords,
  decodeContractCall,
  describeDecodedCall,
  formatTokenAmount,
  parseAmmEvents,
  parseVaultEvents,
  referencedIds,
  segmentsToText,
  type DecodeContext,
} from "./tx-decode";

const SIGNER = "d692627aaedf987f8854e84ab3c4d581d73f6adc13a3d86b512dc9f0d3635237";
const USDC = "6676f971ade3982406efa3e2cdb0477923f8f2a15624c4b6ad3a432817a75e93";
const BOING = "6fce9d3e3f13df9fc17e3fd947148a4e6ce6966538b7dd9bf2a891d3b9699c6b";
const POOL = "2ad75c2e11b1e93761f4f8df39502deecbe7148324e5a80a951798142b2c5b61";
const ROUTER = "806b2462b28f2f5772bbf5ae2628ad3a333bd2c5fa341144e0400ef5c2f1e4c6";

/** What `/api/tx/context` returns for these addresses on the public testnet (boing_listDexTokens / boing_listDexPools). */
const ctx = (interfaceId: string): DecodeContext => ({
  interfaceId,
  tokens: {
    [USDC]: { symbol: "USDC", name: "Testnet USD Coin", decimals: 0 },
    [BOING]: { symbol: "BOING", name: "Boing Token", decimals: 0 },
  },
  pools: { [POOL]: { tokenA: USDC, tokenB: BOING, feeBps: 30 } },
  labels: { [ROUTER]: "Custody router v1 (canonical)", [POOL]: "USDC / tBOING pool (native CP pool v9)" },
});

type Fx = { transactions: Array<{ payload: { ContractCall: { contract: string; calldata: string } } }>; receipts: unknown[] };
const blocks = fixture as unknown as Record<string, Fx>;
const call = (h: string) => blocks[h]!.transactions[0]!.payload.ContractCall;

describe("real testnet txs (blocks 1334 approve, 1335 swap)", () => {
  it("block 1334: approve(router, 2398) on BOING", () => {
    const { contract, calldata } = call("1334");
    const c = decodeContractCall({ contract, calldata, interfaceId: "fungible-v2" })!;
    expect(c.fn.name).toBe("approve");
    expect(c.args[0]!.account).toBe(ROUTER);
    expect(c.args[1]!.value).toBe(BigInt(2398));
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: blocks["1334"]!.receipts[0] as never, ctx: ctx("fungible-v2") });
    expect(d.kind).toBe("approve");
    expect(segmentsToText(d.headline)).toBe("Approved Custody router v1 (canonical) to spend 2,398 BOING");
    expect(d.rows.map((r) => r.label)).toEqual(["Token", "Allowance", "Owner (signer)", "Spender"]);
  });

  it("block 1335: custody-router swap 2,398 BOING -> 2,464 USDC", () => {
    const { contract, calldata } = call("1335");
    const c = decodeContractCall({ contract, calldata, interfaceId: "custody-router" })!;
    expect(c.hops).toEqual([{ pool: POOL, direction: BigInt(1), tokenIn: BOING }]);
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: blocks["1335"]!.receipts[0] as never, ctx: ctx("custody-router") });
    expect(d.kind).toBe("swap");
    expect(segmentsToText(d.headline)).toBe("Swapped 2,398 BOING for 2,464 USDC");
    const rows = Object.fromEntries(d.rows.map((r) => [r.label, segmentsToText(r.value)]));
    expect(rows["Sold"]).toBe("2,398 BOING");
    expect(rows["Received"]).toBe("2,464 USDC");
    expect(rows["Minimum accepted"]).toBe("2,451 USDC");
    expect(rows["Pool"]).toContain("USDC / BOING pool");
    expect(rows["Router"]).toBe("Custody router v1 (canonical)");
    expect(rows["Pool fee"]).toBe("0.30% of the input (≈ 8 BOING)");
    expect(rows["To (recipient)"]).toContain("0xd69262");
    expect(rows["Effective rate"]).toBe("1 BOING ≈ 1.02752 USDC");
  });

  it("a failed swap is described as attempted", () => {
    const { contract, calldata } = call("1335");
    const c = decodeContractCall({ contract, calldata, interfaceId: "custody-router" })!;
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: { success: false, logs: [], return_data: "0x" }, ctx: ctx("custody-router") });
    expect(d.failed).toBe(true);
    expect(segmentsToText(d.headline)).toBe("Attempted to swap 2,398 BOING for at least 2,451 USDC (reverted)");
  });

  it("without a receipt the swap is phrased as a request", () => {
    const { contract, calldata } = call("1335");
    const c = decodeContractCall({ contract, calldata, interfaceId: "custody-router" })!;
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: null, ctx: ctx("custody-router") });
    expect(segmentsToText(d.headline)).toBe("Swap 2,398 BOING for at least 2,451 USDC");
  });

  it("unknown tokens fall back to short addresses and raw units", () => {
    const { contract, calldata } = call("1335");
    const c = decodeContractCall({ contract, calldata, interfaceId: "custody-router" })!;
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: blocks["1335"]!.receipts[0] as never, ctx: { interfaceId: "custody-router", tokens: {}, pools: {}, labels: {} } });
    expect(segmentsToText(d.headline)).toContain("(raw units)");
    expect(segmentsToText(d.headline)).toContain("2,464");
  });

  it("parses the AMM swap log and lists referenced ids", () => {
    const ev = parseAmmEvents((blocks["1335"]!.receipts[0] as { logs: never[] }).logs);
    expect(ev).toEqual([{ kind: "swap", direction: BigInt(1), amountIn: BigInt(2398), amountOut: BigInt(2464) }]);
    const ids = referencedIds(call("1335").calldata);
    expect(ids).toEqual(expect.arrayContaining([SIGNER, POOL, BOING]));
  });
});

const word = (n: bigint | string) => (typeof n === "bigint" ? n.toString(16).padStart(64, "0") : n);

describe("other calls", () => {
  it("transfer / transfer_from", () => {
    const to = "ab".repeat(32);
    const tr = decodeContractCall({ contract: USDC, calldata: `0x${word(BigInt(1))}${to}${word(BigInt(5))}`, interfaceId: "fungible-v2" })!;
    const d = describeDecodedCall(tr, { sender: SIGNER, receipt: { success: true }, ctx: ctx("fungible-v2") });
    expect(segmentsToText(d.headline)).toMatch(/^Sent 5 USDC to 0xababab…abab$/);
    const tf = decodeContractCall({ contract: USDC, calldata: `0x${word(BigInt(9))}${SIGNER}${to}${word(BigInt(7))}`, interfaceId: "fungible-v2" })!;
    expect(describeDecodedCall(tf, { sender: ROUTER, ctx: ctx("fungible-v2") }).kind).toBe("transfer_from");
  });

  it("unlimited approvals are called out", () => {
    const max = (BigInt(1) << BigInt(128)) - BigInt(1);
    const c = decodeContractCall({ contract: USDC, calldata: `0x${word(BigInt(8))}${ROUTER}${word(max)}`, interfaceId: "fungible-v2" })!;
    expect(segmentsToText(describeDecodedCall(c, { sender: SIGNER, ctx: ctx("fungible-v2") }).headline)).toBe("Approve Custody router v1 (canonical) to spend unlimited USDC");
  });

  it("direct custody-pool swap, direction A->B, with recipient (swap_to)", () => {
    const calldata = `0x${word(BigInt(0x15))}${word(BigInt(0))}${word(BigInt(100))}${word(BigInt(90))}${"cd".repeat(32)}${word(BigInt(0))}`;
    const c = decodeContractCall({ contract: POOL, calldata, interfaceId: null, isPool: true })!;
    expect(c.interfaceId).toBe("pool-custody");
    const receipt = { success: true, return_data: `0x${word(BigInt(97))}`, logs: [] };
    const d = describeDecodedCall(c, { sender: SIGNER, receipt, ctx: ctx("pool-custody") });
    expect(segmentsToText(d.headline)).toMatch(/^Swapped 100 USDC for 97 BOING → 0xcdcdcd…cdcd$/);
  });

  it("tells ledger pools from custody pools by calldata length", () => {
    const ledgerSwap = `0x${word(BigInt(0x10))}${word(BigInt(1))}${word(BigInt(10))}${word(BigInt(1))}`;
    expect(decodeContractCall({ contract: POOL, calldata: ledgerSwap, interfaceId: null, isPool: true })!.interfaceId).toBe("pool-ledger");
    const custodySwap = `${ledgerSwap}${word(BigInt(0))}`;
    expect(decodeContractCall({ contract: POOL, calldata: custodySwap, interfaceId: null, isPool: true })!.interfaceId).toBe("pool-custody");
  });

  it("add and remove liquidity use the receipt log", () => {
    const add = `0x${word(BigInt(0x11))}${word(BigInt(100))}${word(BigInt(50))}${word(BigInt(1))}${word(BigInt(0))}`;
    const c = decodeContractCall({ contract: POOL, calldata: add, interfaceId: "pool-custody" })!;
    const topic = "0x" + Buffer.from("BOING_NATIVEAMM_ADDLP_V1").toString("hex").padEnd(64, "0");
    const log = { topics: [topic, `0x${SIGNER}`], data: `0x${word(BigInt(100))}${word(BigInt(50))}${word(BigInt(70))}` };
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: { success: true, logs: [log] }, ctx: ctx("pool-custody") });
    expect(segmentsToText(d.headline)).toBe("Added liquidity: 100 USDC + 50 BOING, minted 70 LP");
    const rm = `0x${word(BigInt(0x12))}${word(BigInt(70))}${word(BigInt(1))}${word(BigInt(1))}${word(BigInt(0))}`;
    const r = decodeContractCall({ contract: POOL, calldata: rm, interfaceId: "pool-custody" })!;
    expect(describeDecodedCall(r, { sender: SIGNER, ctx: ctx("pool-custody") }).kind).toBe("remove_liquidity");
  });

  it("ledger router forwards a pool call", () => {
    const inner = `${word(BigInt(0x10))}${word(BigInt(1))}${word(BigInt(10))}${word(BigInt(1))}`;
    const c = decodeContractCall({ contract: ROUTER, calldata: `0x${word(BigInt(0xe0))}${POOL}${inner}`, interfaceId: "ledger-router" })!;
    expect(c.inner?.fn.name).toBe("swap");
    expect(describeDecodedCall(c, { sender: SIGNER, ctx: ctx("ledger-router") }).kind).toBe("swap");
  });

  it("returns null for shapes it does not understand", () => {
    expect(decodeContractCall({ contract: USDC, calldata: "0xbecbec", interfaceId: "fungible-v2" })).toBeNull();
    expect(decodeContractCall({ contract: USDC, calldata: { omitted: true, size: 96 }, interfaceId: "fungible-v2" })).toBeNull();
    expect(decodeContractCall({ contract: USDC, calldata: `0x${word(BigInt(0x77))}`, interfaceId: "fungible-v2" })).toBeNull();
    expect(decodeContractCall({ contract: USDC, calldata: `0x${word(BigInt(1))}`, interfaceId: null })).toBeNull();
    expect(calldataWords("0x12")).toBeNull();
  });

  it("unknown selectors on a known interface are handled by the caller (null here)", () => {
    expect(decodeContractCall({ contract: ROUTER, calldata: `0x${word(BigInt(0xf1))}${word(BigInt(9))}`, interfaceId: "custody-router" })).toBeNull();
  });
});

describe("formatTokenAmount", () => {
  it("honours decimals", () => {
    expect(formatTokenAmount(BigInt("1500000000000000000"), 18)).toBe("1.5");
    expect(formatTokenAmount(BigInt(5), 18)).toBe("0.000000000000000005");
    expect(formatTokenAmount(BigInt("1000000000000000000000"), 18)).toBe("1,000");
    expect(formatTokenAmount(BigInt(2398), 0)).toBe("2,398");
    expect(formatTokenAmount(BigInt(2398), null)).toBe("2,398");
  });
});

// ---------------------------------------------------------------------------------------------------------
// LP vault v2: real testnet transactions (canonical USDC / BOING vault, block 105 deposit, block 106 withdraw)
// ---------------------------------------------------------------------------------------------------------

const VAULT = "236a851dd50faaa268e2e1b7ba95cfb9993773abf63a4c0d949183d8302e65c7";
const vaultBlocks = vaultFixture as unknown as Record<string, Fx>;
const vaultCall = (h: string) => vaultBlocks[h]!.transactions[0]!.payload.ContractCall;
const vaultCtx = (withVault: boolean): DecodeContext => ({
  ...ctx("lp-vault-v2"),
  vaults: withVault ? { [VAULT]: { pool: POOL, tokenA: USDC, tokenB: BOING } } : {},
  labels: { [VAULT]: "LP vault v2 (canonical USDC/BOING)", [POOL]: "USDC / tBOING pool (native CP pool v9)" },
});
const rowsOf = (d: ReturnType<typeof describeDecodedCall>) => Object.fromEntries(d.rows.map((r) => [r.label, segmentsToText(r.value)]));

describe("LP vault v2 (real testnet txs)", () => {
  it("block 105: deposit(50, 50, min 48) mints 49 shares", () => {
    const { contract, calldata } = vaultCall("105");
    const c = decodeContractCall({ contract, calldata, interfaceId: "lp-vault-v2" })!;
    expect(c.fn.name).toBe("deposit");
    const receipt = vaultBlocks["105"]!.receipts[0] as never;
    const d = describeDecodedCall(c, { sender: SIGNER, receipt, ctx: vaultCtx(true) });
    expect(d.kind).toBe("vault_deposit");
    expect(segmentsToText(d.headline)).toBe("Deposited into vault: 50 USDC + 50 BOING, minted 49 vault shares");
    const rows = rowsOf(d);
    expect(rows["Shares minted"]).toBe("49");
    expect(rows["Vault"]).toContain("USDC / BOING vault");
    expect(rows["Deposited A"]).toBe("50 USDC");
    expect(d.failed).toBe(false);
  });

  it("block 106: withdraw(20 shares) pays 20 USDC + 19 BOING (from the pool log, not the minimums)", () => {
    const { contract, calldata } = vaultCall("106");
    const c = decodeContractCall({ contract, calldata, interfaceId: "lp-vault-v2" })!;
    expect(c.fn.name).toBe("withdraw");
    const receipt = vaultBlocks["106"]!.receipts[0] as never;
    const d = describeDecodedCall(c, { sender: SIGNER, receipt, ctx: vaultCtx(true) });
    expect(d.kind).toBe("vault_withdraw");
    expect(segmentsToText(d.headline)).toBe("Withdrew from vault: burned 20 vault shares for 20 USDC + 19 BOING");
    const rows = rowsOf(d);
    expect(rows["Received A"]).toBe("20 USDC");
    expect(rows["Received B"]).toBe("19 BOING");
    expect(rows["Minimum A"]).toBe("19 USDC");
    expect(rows["Minimum B"]).toBe("18 BOING");
  });

  it("without the vault's token pair it still decodes, in raw units", () => {
    const { contract, calldata } = vaultCall("105");
    const c = decodeContractCall({ contract, calldata, interfaceId: "lp-vault-v2" })!;
    const d = describeDecodedCall(c, { sender: SIGNER, receipt: vaultBlocks["105"]!.receipts[0] as never, ctx: vaultCtx(false) });
    expect(d.kind).toBe("vault_deposit");
    expect(segmentsToText(d.headline)).toContain("50 (raw units) + 50 (raw units)");
  });

  it("without a receipt a withdrawal is phrased as a request, and a failed one as attempted", () => {
    const { contract, calldata } = vaultCall("106");
    const c = decodeContractCall({ contract, calldata, interfaceId: "lp-vault-v2" })!;
    const pending = describeDecodedCall(c, { sender: SIGNER, ctx: vaultCtx(true) });
    expect(segmentsToText(pending.headline)).toBe("Vault withdrawal: burn 20 vault shares");
    const failed = describeDecodedCall(c, { sender: SIGNER, receipt: { success: false, logs: [] }, ctx: vaultCtx(true) });
    expect(failed.failed).toBe(true);
    expect(segmentsToText(failed.headline)).toBe("Attempted vault withdrawal: burn 20 vault shares");
  });

  it("transfer_shares and configure", () => {
    const to = "ab".repeat(32);
    const word = (n: bigint) => n.toString(16).padStart(64, "0");
    const calldata = `0x${word(BigInt(0xc3))}${to}${word(BigInt(7))}`;
    const c = decodeContractCall({ contract: VAULT, calldata, interfaceId: "lp-vault-v2" })!;
    const d = describeDecodedCall(c, { sender: SIGNER, ctx: vaultCtx(true) });
    expect(d.kind).toBe("vault_transfer_shares");
    expect(segmentsToText(d.headline)).toContain("Send 7 vault shares to ");
    const cfg = decodeContractCall({ contract: VAULT, calldata: `0x${word(BigInt(0xc0))}${POOL}${USDC}${BOING}`, interfaceId: "lp-vault-v2" })!;
    expect(describeDecodedCall(cfg, { sender: SIGNER, ctx: vaultCtx(true) }).kind).toBe("call");
  });

  it("parseVaultEvents reads the DEPOSIT / WITHDRAW logs", () => {
    const dep = parseVaultEvents((vaultBlocks["105"]!.receipts[0] as { logs: never }).logs);
    expect(dep).toEqual([{ kind: "deposit", amountA: BigInt(50), amountB: BigInt(50), shares: BigInt(49) }]);
    const wd = parseVaultEvents((vaultBlocks["106"]!.receipts[0] as { logs: never }).logs);
    expect(wd).toEqual([{ kind: "withdraw", shares: BigInt(20), minA: BigInt(19), minB: BigInt(18) }]);
  });
});
