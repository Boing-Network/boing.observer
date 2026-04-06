"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useNetwork } from "@/context/network-context";
import { shortenHash } from "@/lib/rpc-types";

type Hop = {
  poolHex: string;
  tokenAHex: string;
  tokenBHex: string;
  tokenInHex: string;
  tokenOutHex: string;
  amountIn: string;
  amountOut: string;
  directionForSwapCalldata: string;
  feeBps: string;
};

type RouteRow = {
  amountIn: string;
  amountOut: string;
  tokenInHex: string;
  tokenOutHex: string;
  hops: Hop[];
};

type QuoteResponse = {
  chainId: number | null;
  headHeight: number;
  pairsCount: string | null;
  logsMode: string;
  venueCount: number;
  routes: RouteRow[];
};

export function QuotePanel() {
  const { network } = useNetwork();
  const [tokenIn, setTokenIn] = useState("");
  const [tokenOut, setTokenOut] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [logsMode, setLogsMode] = useState<"recent" | "full">("recent");
  const [result, setResult] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/dex/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          network,
          tokenIn: tokenIn.trim(),
          tokenOut: tokenOut.trim(),
          amountIn: amountIn.trim(),
          logs: logsMode,
        }),
      });
      const json = (await res.json()) as { error?: string } & Partial<QuoteResponse>;
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setResult(json as QuoteResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="glass-card space-y-4 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Inputs</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          32-byte Boing AccountIds (0x + 64 hex). Amount is smallest units (decimal string, e.g. u128).
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Token in</span>
          <input
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="hash w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm"
            placeholder="0x…"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Token out</span>
          <input
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="hash w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm"
            placeholder="0x…"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Amount in</span>
          <input
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="hash w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 text-sm"
            placeholder="e.g. 1000000"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Pool discovery range
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="logs"
              checked={logsMode === "recent"}
              onChange={() => setLogsMode("recent")}
            />
            Recent 128 blocks (default)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="logs" checked={logsMode === "full"} onChange={() => setLogsMode("full")} />
            Full chain (chunked getLogs — slower)
          </label>
        </fieldset>
        <p className="text-xs text-[var(--text-muted)]">Network: {network}</p>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-network-primary px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-network-primary-light disabled:opacity-60"
        >
          {loading ? "Computing…" : "Find routes"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <section className="glass-card space-y-2 p-4 sm:p-6 text-sm">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Result</h2>
            <p className="text-[var(--text-muted)]">
              Head {result.headHeight} · venues hydrated {result.venueCount} · log mode {result.logsMode}
            </p>
            <p className="text-[var(--text-muted)]">Routes returned: {result.routes.length}</p>
          </section>
          <ul className="space-y-4">
            {result.routes.map((r, i) => (
              <li key={i} className="glass-card space-y-3 p-4 sm:p-6">
                <p className="font-display text-sm font-semibold text-network-cyan">
                  Route #{i + 1}: out = {r.amountOut} (in {r.amountIn})
                </p>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
                  {r.hops.map((h, j) => (
                    <li key={j}>
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        Pool {shortenHash(h.poolHex, 8, 6)} · fee {h.feeBps} bps · dir {h.directionForSwapCalldata}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-[var(--text-muted)]">
        <Link href="/dex/pools" className="text-network-cyan hover:underline">
          ← DEX directory
        </Link>
      </p>
    </div>
  );
}
