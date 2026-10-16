/**
 * Deploy heights for an account from the node's indexed `boing_getAccountTransactions`
 * (full history, deterministic paging) instead of a bounded recent-block window.
 */

export type AccountDeployHeights = { supported: boolean; heights: number[]; scannedTxs: number };

type Row = { block_height?: number; direction?: string; payload?: { kind?: string } };

export function deployHeightsFromRows(rows: Row[]): number[] {
  const set = new Set<number>();
  for (const r of rows) {
    if (r?.direction === "out" && r.payload?.kind === "contract_deploy" && Number.isInteger(r.block_height)) {
      set.add(r.block_height as number);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export async function fetchAccountDeployHeights(
  rpcUrl: string,
  accountHex: string,
  opts: { maxPages?: number; fetchImpl?: typeof fetch } = {},
): Promise<AccountDeployHeights> {
  const f = opts.fetchImpl ?? fetch;
  const maxPages = opts.maxPages ?? 10;
  const rows: Row[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    let j: { result?: { transactions?: Row[]; next_cursor?: string | null }; error?: { code?: number } };
    try {
      const res = await f(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "boing_getAccountTransactions",
          params: [accountHex, { cursor, limit: 100 }],
        }),
      });
      j = await res.json();
    } catch {
      return { supported: page > 0, heights: deployHeightsFromRows(rows), scannedTxs: rows.length };
    }
    if (j.error || !j.result) {
      return { supported: page > 0, heights: deployHeightsFromRows(rows), scannedTxs: rows.length };
    }
    rows.push(...(j.result.transactions ?? []));
    cursor = j.result.next_cursor ?? null;
    if (!cursor) break;
  }
  return { supported: true, heights: deployHeightsFromRows(rows), scannedTxs: rows.length };
}