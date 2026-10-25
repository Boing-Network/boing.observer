"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ExplorerCrumbs } from "@/components/explorer-crumbs";
import { ExplorerHexLink } from "@/components/explorer-hex-link";
import { useNetwork } from "@/context/network-context";
import {
  blocksToHuman,
  boingNameRentPerYear,
  fetchNameInfo,
  fetchReverseName,
  normalizeBoingName,
  type BoingNameInfo,
} from "@/lib/boing-names";
import type { NetworkId } from "@/lib/rpc-methods";

const STATUS_STYLE: Record<string, string> = {
  active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  grace: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  expired: "border-red-400/40 bg-red-400/10 text-red-300",
};

export default function NamePage() {
  const params = useParams<{ label: string }>();
  const { network, ready } = useNetwork();
  const raw = decodeURIComponent(params?.label ?? "");
  const v = normalizeBoingName(raw);
  const [info, setInfo] = useState<BoingNameInfo | null | undefined>(undefined);
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!v.ok || !ready) return;
    let live = true;
    setInfo(undefined);
    setError("");
    fetchNameInfo(network as NetworkId, v.label)
      .then(async (i) => {
        if (!live) return;
        setInfo(i);
        const target = i?.record?.target;
        if (target && i?.record?.status === "active") {
          const rev = await fetchReverseName(network as NetworkId, target).catch(() => null);
          if (live) setIsPrimary(rev?.name === v.label);
        } else setIsPrimary(false);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [network, ready, v.ok ? v.label : ""]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = v.ok ? `${v.label}.boing` : raw;
  const rec = info?.record;
  const head = info?.head_height ?? 0;
  const bpy = info?.registry?.blocks_per_year;

  return (
    <div className="space-y-6" data-testid="name-page">
      <header className="space-y-3">
        <ExplorerCrumbs items={[{ label: "Home", href: "/" }, { label: "Names" }, { label: display }]} />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl" data-testid="name-title">
            {display}
          </h1>
          {rec ? (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[rec.status] ?? ""}`} data-testid="name-status">
              {rec.status}
            </span>
          ) : null}
          {isPrimary ? (
            <span className="rounded-full border border-network-cyan/40 bg-network-cyan/10 px-2 py-0.5 text-xs text-network-cyan">
              primary name
            </span>
          ) : null}
        </div>
      </header>

      {!v.ok ? (
        <p className="text-red-400" role="alert">
          Not a valid name: {v.error}
        </p>
      ) : error ? (
        <p className="text-amber-300" role="alert">
          {error}
        </p>
      ) : info === undefined ? (
        <p className="text-[var(--text-muted)]">Loading…</p>
      ) : info === null || info.registry?.enabled === false ? (
        <p className="text-[var(--text-muted)]" data-testid="name-registry-off">
          Names are not enabled on this network.
        </p>
      ) : rec ? (
        <section className="glass-card space-y-4 p-4 sm:p-6" aria-label="Name record">
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-[var(--text-muted)]">Resolves to</dt>
            <dd data-testid="name-target">
              <ExplorerHexLink value={rec.target} network={network} kind="account" head={12} tail={10} copy />
            </dd>
            <dt className="text-[var(--text-muted)]">Owner</dt>
            <dd data-testid="name-owner">
              <ExplorerHexLink value={rec.owner} network={network} kind="account" head={12} tail={10} copy />
            </dd>
            <dt className="text-[var(--text-muted)]">Registered</dt>
            <dd>
              <Link className="text-network-cyan hover:underline" href={`/block/${rec.registered_at}?network=${network}`}>
                block {rec.registered_at.toLocaleString()}
              </Link>
            </dd>
            <dt className="text-[var(--text-muted)]">Expires</dt>
            <dd data-testid="name-expires">
              block {rec.expires_at.toLocaleString()}
              {rec.expires_at > head ? (
                <span className="text-[var(--text-muted)]"> ({blocksToHuman(rec.expires_at - head, bpy)} left at 2 s blocks)</span>
              ) : null}
            </dd>
            <dt className="text-[var(--text-muted)]">Rent</dt>
            <dd>{boingNameRentPerYear(v.label)} BOING / year (burned)</dd>
          </dl>
          {rec.status === "grace" ? (
            <p className="text-sm text-amber-300">Expired: in the grace period only the owner can renew it. It does not resolve.</p>
          ) : null}
        </section>
      ) : (
        <section className="glass-card space-y-2 p-4 sm:p-6" data-testid="name-available">
          <p className="text-[var(--text-primary)]">
            {info.reserved ? (
              <>
                <strong>{display}</strong> is reserved.
              </>
            ) : info.available ? (
              <>
                <strong>{display}</strong> is available for {info.rent_per_year_boing ?? boingNameRentPerYear(v.label)} BOING / year.
              </>
            ) : (
              <>
                <strong>{display}</strong> is not registered.
              </>
            )}
          </p>
          {info.available ? (
            <p className="text-sm text-[var(--text-muted)]">
              Claim it in{" "}
              <a className="text-network-cyan hover:underline" href="https://boing.express/wallet" target="_blank" rel="noopener noreferrer">
                Boing Express
              </a>{" "}
              (Settings → Names) or with <code className="font-mono">boing name claim {v.label}</code>.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}