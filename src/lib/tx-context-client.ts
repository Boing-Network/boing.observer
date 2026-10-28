import type { TxContextResponse } from "@/app/api/tx/context/route";

const inflight = new Map<string, Promise<TxContextResponse | null>>();

/**
 * Names / decimals / pool pairs for the addresses a contract call mentions (`/api/tx/context`).
 * Requests are de-duplicated per page (block pages ask once per call row); failures resolve to `null`
 * so the explorer keeps showing the generic view.
 */
export function fetchTxContext(network: string, contract: string, ids: string[]): Promise<TxContextResponse | null> {
  const sorted = Array.from(new Set(ids)).sort();
  const key = `${network}:${contract}:${sorted.join(",")}`;
  const hit = inflight.get(key);
  if (hit) return hit;
  const qs = new URLSearchParams({ network, contract, ids: sorted.join(",") });
  const p = fetch(`/api/tx/context?${qs.toString()}`, { headers: { Accept: "application/json" } })
    .then(async (res) => (res.ok ? ((await res.json()) as TxContextResponse) : null))
    .catch(() => null)
    .then((v) => {
      if (v === null) setTimeout(() => inflight.delete(key), 15_000); // retry later, not in a tight loop
      return v;
    });
  inflight.set(key, p);
  return p;
}
