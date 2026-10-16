/**
 * Find a contract's deploy bytecode without a dedicated RPC.
 *
 * The node has no `getCode` method and `boing_getAccountTransactions(contract)` lists calls *to* the contract but
 * not its deploy. Contract addresses are deterministic (CREATE2 or BLAKE3(sender || nonce)), so we take the earliest
 * accounts that called the contract (deployers almost always configure their contract first), list their own
 * `contract_deploy` transactions, fetch those blocks and recompute each deploy's address until one matches.
 */
import { tryPredictDeployedContractAddressFromDeployTx } from "./deploy-contract-address";
import type { ContractCodeInfo } from "./contract-identify";
import { getTxPayloadInner } from "./tx-payload";

type Rpc = <T>(method: string, params: unknown[]) => Promise<T>;

type TxRow = {
  block_height?: number;
  tx_index?: number;
  direction?: string;
  sender?: string;
  payload?: { kind?: string; contract?: string };
};

const h64 = (h: unknown) => (typeof h === "string" ? h.replace(/^0x/i, "").toLowerCase() : "");

async function allRows(rpc: Rpc, account: string, maxPages: number): Promise<TxRow[] | null> {
  const rows: TxRow[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    let r: { transactions?: TxRow[]; next_cursor?: string | null };
    try {
      r = await rpc(`boing_getAccountTransactions`, [`0x${account}`, { cursor, limit: 100 }]);
    } catch {
      return i === 0 ? null : rows;
    }
    rows.push(...(r.transactions ?? []));
    cursor = r.next_cursor ?? null;
    if (!cursor) break;
  }
  return rows;
}

export type ContractCodeLookup = {
  /** Calls to this address were seen (it behaves as a contract). */
  calledAsContract: boolean;
  callCount: number;
  code: ContractCodeInfo | null;
  /** The account-history RPC is unavailable on this node. */
  historyUnsupported?: boolean;
};

export async function lookupContractCode(
  rpc: Rpc,
  address64: string,
  opts: { extraDeployers?: string[]; maxDeployers?: number; maxBlocks?: number } = {},
): Promise<ContractCodeLookup> {
  const target = h64(address64);
  const rows = await allRows(rpc, target, 10);
  if (rows == null) return { calledAsContract: false, callCount: 0, code: null, historyUnsupported: true };
  const calls = rows.filter((r) => h64(r.payload?.contract) === target);
  // Oldest callers first (rows are newest first).
  const senders: string[] = [];
  for (const r of [...calls].reverse()) {
    const s = h64(r.sender);
    if (s && !senders.includes(s)) senders.push(s);
  }
  for (const d of opts.extraDeployers ?? []) {
    const s = h64(d);
    if (s && !senders.includes(s)) senders.push(s);
  }
  const maxDeployers = opts.maxDeployers ?? 3;
  let blocksLeft = opts.maxBlocks ?? 40;
  const blockCache = new Map<number, { transactions?: unknown[] } | null>();
  for (const deployer of senders.slice(0, maxDeployers)) {
    const drows = await allRows(rpc, deployer, 10);
    if (!drows) continue;
    const deploys = drows.filter(
      (r) => r.direction === "out" && String(r.payload?.kind ?? "").startsWith("contract_deploy") && Number.isInteger(r.block_height),
    );
    for (const d of deploys) {
      const height = d.block_height as number;
      let block = blockCache.get(height);
      if (block === undefined) {
        if (blocksLeft-- <= 0) break;
        try {
          block = await rpc<{ transactions?: unknown[] } | null>("boing_getBlockByHeight", [height]);
        } catch {
          block = null;
        }
        blockCache.set(height, block);
      }
      const txs = (block?.transactions ?? []) as { sender?: unknown; nonce?: unknown; payload?: unknown }[];
      const candidates = Number.isInteger(d.tx_index) ? [txs[d.tx_index as number]] : txs;
      for (const tx of candidates) {
        if (!tx) continue;
        const predicted = tryPredictDeployedContractAddressFromDeployTx(tx, tx.payload);
        if (predicted && predicted.toLowerCase() === target) {
          const bytecodeHex = extractBytecodeHex(tx.payload);
          if (bytecodeHex) {
            return {
              calledAsContract: calls.length > 0,
              callCount: calls.length,
              code: { bytecodeHex, deployer, height, txIndex: txs.indexOf(tx) },
            };
          }
        }
      }
    }
  }
  return { calledAsContract: calls.length > 0, callCount: calls.length, code: null };
}

function extractBytecodeHex(payload: unknown): string | null {
  const bc = getTxPayloadInner(payload).bytecode;
  if (Array.isArray(bc)) return bc.map((b) => Number(b).toString(16).padStart(2, "0")).join("");
  if (typeof bc === "string") return bc.replace(/^0x/i, "").toLowerCase();
  return null;
}