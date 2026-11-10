"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { explorerAccountHref, explorerAssetHref, explorerItemHref } from "@/lib/explorer-href";
import { shortenHash } from "@/lib/rpc-types";

type Holder = { account: string; balance: string | null; lastBlockHeight: number; lastTxId: string };
type ItemInfo = {
  contract: string;
  itemId: string;
  isReference: boolean;
  totalSupply?: string;
  metadataHash?: string;
  admin?: string;
  account?: string | null;
  balance?: string | null;
  holders?: Holder[];
  holdersError?: string | null;
  error?: string;
};

const bare = (h: string) => h.replace(/^0x/i, "").toLowerCase();
const isZero = (h?: string) => !h || /^0*$/.test(bare(h));

/** Item-type page for the Boing reference multi-token: supply, type-level metadata, admin, holders. */
export function ItemTypeView() {
  const params = useParams<{ contract: string; itemId: string }>();
  const search = useSearchParams();
  const network = search.get("network") === "mainnet" ? "mainnet" : "testnet";
  const contract = bare(String(params.contract ?? ""));
  const itemId = String(params.itemId ?? "");
  const [info, setInfo] = useState<ItemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState(search.get("account") ?? "");
  const [jump, setJump] = useState("");

  useEffect(() => {
    let live = true;
    setInfo(null);
    setError(null);
    const u = new URL("/api/items", window.location.origin);
    u.searchParams.set("network", network);
    u.searchParams.set("contract", contract);
    u.searchParams.set("itemId", itemId);
    const acct = search.get("account");
    if (acct) u.searchParams.set("account", acct);
    fetch(u.toString(), { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json()) as ItemInfo;
        if (!live) return;
        if (!r.ok) setError(j.error ?? `HTTP ${r.status}`);
        else setInfo(j);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Request failed"));
    return () => {
      live = false;
    };
  }, [contract, itemId, network, search]);

  const card = "glass-card p-4";
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Game item type</p>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)]">Item #{itemId}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          In item collection{" "}
          <Link href={explorerAssetHref(contract, network)} className="font-mono text-network-cyan hover:underline">
            {shortenHash(contract)}
          </Link>{" "}
          (Boing reference multi-token: every holder of item #{itemId} holds the same item; balances are quantities).
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}
      {!info && !error ? <div className="glass-card h-32 animate-pulse rounded-lg bg-white/5" aria-busy="true" /> : null}

      {info && !info.isReference ? (
        <p className={card}>This contract is not the Boing reference multi-token template, so item ids do not apply.</p>
      ) : null}

      {info?.isReference ? (
        <>
          <dl className={`${card} grid gap-3 sm:grid-cols-2`}>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Total supply</dt>
              <dd className="font-mono text-lg text-[var(--text-primary)]" data-testid="item-supply">
                {info.totalSupply}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Metadata hash (type-level)</dt>
              <dd className="break-all font-mono text-xs text-[var(--text-secondary)]">
                {isZero(info.metadataHash) ? "not set" : `0x${info.metadataHash}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Collection admin (can mint)</dt>
              <dd className="font-mono text-xs">
                {info.admin && !isZero(info.admin) ? (
                  <Link href={explorerAccountHref(info.admin, network)} className="text-network-cyan hover:underline">
                    {shortenHash(info.admin)}
                  </Link>
                ) : (
                  "none"
                )}
              </dd>
            </div>
            {info.account ? (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Balance of {shortenHash(info.account)}</dt>
                <dd className="font-mono text-lg text-[var(--text-primary)]">{info.balance}</dd>
              </div>
            ) : null}
          </dl>

          <form
            className={`${card} flex flex-wrap items-end gap-3`}
            onSubmit={(e) => {
              e.preventDefault();
              const a = bare(account);
              if (/^[0-9a-f]{64}$/.test(a)) window.location.href = `${explorerItemHref(contract, itemId, network)}&account=${a}`;
            }}
          >
            <label className="flex-1 text-xs text-[var(--text-muted)]">
              Check a balance
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="0x… account (64 hex)"
                className="mt-1 w-full rounded border border-[var(--border-color)] bg-black/20 px-2 py-1 font-mono text-xs text-[var(--text-primary)]"
              />
            </label>
            <button type="submit" className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs">
              Check
            </button>
          </form>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">Holders</h2>
            {info.holdersError ? <p className="text-xs text-[var(--text-muted)]">{info.holdersError}</p> : null}
            {(info.holders ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No indexed holders yet.</p>
            ) : (
              <ul className="glass-card divide-y divide-white/5">
                {(info.holders ?? []).map((h) => (
                  <li key={h.account} className="flex items-center justify-between px-4 py-2 text-sm">
                    <Link href={explorerAccountHref(h.account, network)} className="font-mono text-network-cyan hover:underline">
                      {shortenHash(bare(h.account))}
                    </Link>
                    <span className="font-mono">× {h.balance ?? "?"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{1,20}$/.test(jump.trim())) window.location.href = explorerItemHref(contract, jump.trim(), network);
        }}
      >
        <label className="text-xs text-[var(--text-muted)]">
          Other item id
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            inputMode="numeric"
            className="mt-1 block w-32 rounded border border-[var(--border-color)] bg-black/20 px-2 py-1 font-mono text-xs"
          />
        </label>
        <button type="submit" className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs">
          Open
        </button>
      </form>
    </div>
  );
}
