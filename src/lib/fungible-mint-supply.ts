/**
 * Resolve fixed total supply for Boing reference fungible tokens from the one-time `mint_first` (0x02) call.
 *
 * Reference templates have no `total_supply()` selector; supply is set once via mint_first and never increases
 * (v1 self-transfer quirk aside). See boing.network `docs/BOING-REFERENCE-TOKEN.md`.
 */

import { normalizeHexData } from "@/lib/tx-details";
import { hexForLink, normalizeHex64 } from "@/lib/rpc-types";

export const REF_FUNGIBLE_SELECTOR_MINT_FIRST = 0x02;

export type MintFirstDecoded = {
  to: string;
  amount: string;
};

export type FungibleTotalSupply = {
  amount: string;
  mintTo: string;
  mintTxId: string | null;
  mintBlockHeight: number | null;
  source: "mint_first";
};

type Rpc = <T>(method: string, params: unknown[]) => Promise<T>;

type IndexedTxRow = {
  block_height?: number;
  tx_index?: number;
  tx_id?: string;
  success?: boolean | null;
  payload?: { kind?: string; calldata_len?: number; contract?: string; steps?: Array<{ kind?: string; calldata_len?: number; contract?: string }> };
};

/** Decode reference `mint_first(to, amount)` calldata (96 bytes). */
export function parseMintFirstFromCalldata(calldata: unknown): MintFirstDecoded | null {
  const { prefixed, bytes } = normalizeHexData(calldata);
  if (bytes < 96) return null;
  const h = prefixed.slice(2).toLowerCase();
  const selector = Number.parseInt(h.slice(62, 64), 16);
  if (selector !== REF_FUNGIBLE_SELECTOR_MINT_FIRST) return null;
  const to = normalizeHex64(h.slice(64, 128));
  if (!to) return null;
  const amountWord = h.slice(128, 192);
  if (!/^[0-9a-f]{64}$/.test(amountWord)) return null;
  return { to, amount: BigInt(`0x${amountWord}`).toString() };
}

function calldataFromTxPayload(payload: unknown, token64: string): unknown | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const want = token64.toLowerCase();

  const tryCall = (body: Record<string, unknown>): unknown | null => {
    const c = hexForLink(body.contract).toLowerCase();
    if (c !== want) return null;
    return body.calldata ?? null;
  };

  if ("ContractCall" in p && p.ContractCall && typeof p.ContractCall === "object") {
    return tryCall(p.ContractCall as Record<string, unknown>);
  }
  if ("ContractCallWithValue" in p && p.ContractCallWithValue && typeof p.ContractCallWithValue === "object") {
    return tryCall(p.ContractCallWithValue as Record<string, unknown>);
  }
  if ("Batch" in p && p.Batch && typeof p.Batch === "object") {
    const steps = (p.Batch as { steps?: unknown[] }).steps ?? [];
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const s = step as Record<string, unknown>;
      if ("ContractCall" in s && s.ContractCall && typeof s.ContractCall === "object") {
        const cd = tryCall(s.ContractCall as Record<string, unknown>);
        if (cd != null) {
          const decoded = parseMintFirstFromCalldata(cd);
          if (decoded) return cd;
        }
      }
      if ("ContractCallWithValue" in s && s.ContractCallWithValue && typeof s.ContractCallWithValue === "object") {
        const cd = tryCall(s.ContractCallWithValue as Record<string, unknown>);
        if (cd != null && parseMintFirstFromCalldata(cd)) return cd;
      }
      // Flat step shape
      if (String(s.kind ?? "").toLowerCase().includes("contract")) {
        const cd = tryCall(s);
        if (cd != null && parseMintFirstFromCalldata(cd)) return cd;
      }
    }
  }
  // Flat { kind, contract, calldata }
  if (String(p.kind ?? "").toLowerCase().includes("contract")) {
    return tryCall(p);
  }
  return null;
}

function rowLooksLikeMintCandidate(row: IndexedTxRow, token64: string): boolean {
  if (row.success === false) return false;
  const want = token64.toLowerCase();
  const p = row.payload;
  if (!p) return false;
  if (p.kind === "contract_call" && hexForLink(p.contract).toLowerCase() === want && (p.calldata_len ?? 0) >= 96) {
    return true;
  }
  if (p.kind === "batch" && Array.isArray(p.steps)) {
    return p.steps.some(
      (s) =>
        (s.kind === "contract_call" || String(s.kind ?? "").includes("contract")) &&
        hexForLink(s.contract).toLowerCase() === want &&
        (s.calldata_len ?? 0) >= 96,
    );
  }
  return false;
}

/**
 * Walk `boing_getAccountTransactions` (newest first), keep 96-byte calls to the token, then inspect the
 * oldest candidates' full block payloads for a successful `mint_first`.
 */
export async function resolveFungibleTotalSupplyFromMintFirst(
  rpc: Rpc,
  tokenAddress64: string,
  opts: { maxPages?: number; maxCandidates?: number } = {},
): Promise<FungibleTotalSupply | null> {
  const token64 = normalizeHex64(tokenAddress64.replace(/^0x/i, ""));
  if (!token64) return null;

  const maxPages = opts.maxPages ?? 12;
  const maxCandidates = opts.maxCandidates ?? 8;
  const candidates: IndexedTxRow[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    let result: { transactions?: IndexedTxRow[]; next_cursor?: string | null };
    try {
      result = await rpc("boing_getAccountTransactions", [`0x${token64}`, { cursor, limit: 100 }]);
    } catch {
      break;
    }
    const rows = result.transactions ?? [];
    for (const row of [...rows].reverse()) {
      if (rowLooksLikeMintCandidate(row, token64)) candidates.push(row);
    }
    // Prefer oldest: keep collecting; trim later
    cursor = result.next_cursor ?? null;
    if (!cursor) break;
  }

  // Oldest first among collected candidates
  candidates.sort((a, b) => (a.block_height ?? 0) - (b.block_height ?? 0) || (a.tx_index ?? 0) - (b.tx_index ?? 0));
  const inspect = candidates.slice(0, maxCandidates);

  for (const row of inspect) {
    const height = row.block_height;
    const txIndex = row.tx_index;
    if (height == null || txIndex == null) continue;
    let block: { transactions?: unknown[]; receipts?: Array<{ success?: boolean; tx_id?: unknown } | null> } | null;
    try {
      block = await rpc("boing_getBlockByHeight", [height, true]);
    } catch {
      continue;
    }
    const tx = block?.transactions?.[txIndex];
    if (!tx || typeof tx !== "object") continue;
    const receipt = block?.receipts?.[txIndex] ?? null;
    if (receipt?.success === false) continue;
    const payload = (tx as { payload?: unknown }).payload;
    const calldata = calldataFromTxPayload(payload, token64);
    if (calldata == null) continue;
    const decoded = parseMintFirstFromCalldata(calldata);
    if (!decoded) continue;
    const txIdRaw = typeof receipt?.tx_id === "string" ? normalizeHex64(String(receipt.tx_id).replace(/^0x/i, "")) : "";
    const indexedId = typeof row.tx_id === "string" ? normalizeHex64(row.tx_id.replace(/^0x/i, "")) : "";
    return {
      amount: decoded.amount,
      mintTo: decoded.to,
      mintTxId: txIdRaw || indexedId || null,
      mintBlockHeight: height,
      source: "mint_first",
    };
  }

  return null;
}
