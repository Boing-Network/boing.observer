"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNetwork } from "@/context/network-context";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { CopyButton } from "@/components/copy-button";
import {
  CANONICAL_QA_DOC_URL,
  CANONICAL_QA_POOL_CONFIG_JSON_URL,
  CANONICAL_QA_REGISTRY_JSON_URL,
  QA_DOC_URL,
  QA_RPC_TWO_SURFACES_DOC_URL,
  RPC_SPEC_URL,
} from "@/lib/constants";
import { fetchQaPoolConfig, fetchQaPoolList, fetchQaRegistry } from "@/lib/rpc-methods";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import type { QaPoolConfigResult, QaPoolItemSummary, QaRegistryResult } from "@/lib/rpc-types";
import { explorerAssetHref } from "@/lib/explorer-href";
import { hexForLink, normalizeHex64, shortenHash } from "@/lib/rpc-types";
import {
  QaReviewerSessionPanel,
  QaReviewerVoteButtons,
  useQaReviewerSession,
} from "@/components/qa-reviewer-gate";

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function pct(f: number): string {
  if (typeof f !== "number" || Number.isNaN(f)) return "—";
  return `${(f * 100).toFixed(1)}%`;
}

function ConfigStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/50 px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-[var(--text-primary)]">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

const RPC_QA_ERRORS: { code: string; summary: string }[] = [
  { code: "-32050", summary: "Deployment rejected by protocol QA (rule_id + message in response)." },
  { code: "-32051", summary: "Unsure — referred to the governance QA pool; includes pending tx_hash." },
  { code: "-32052", summary: "No pending pool item for that transaction hash." },
  { code: "-32053", summary: "Voter is not a governance QA administrator." },
  { code: "-32054", summary: "QA pool disabled by governance (e.g. no admins / zero capacity)." },
  { code: "-32055", summary: "Global pool capacity reached." },
  { code: "-32056", summary: "Per-deployer pending cap reached." },
  { code: "-32057", summary: "Operator RPC auth — vote/apply require X-Boing-Operator when the node sets BOING_OPERATOR_RPC_TOKEN." },
];

export function QaTransparencyDashboard() {
  const { network } = useNetwork();
  const [config, setConfig] = useState<QaPoolConfigResult | null>(null);
  const [items, setItems] = useState<QaPoolItemSummary[]>([]);
  const [registry, setRegistry] = useState<QaRegistryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { session, signIn, signOut } = useQaReviewerSession();

  const load = useCallback(async () => {
    setError(null);
    setRegistryError(null);
    try {
      const [cfgRes, listRes, regRes] = await Promise.allSettled([
        fetchQaPoolConfig(network),
        fetchQaPoolList(network),
        fetchQaRegistry(network),
      ]);

      if (cfgRes.status === "rejected") {
        setConfig(null);
        setItems([]);
        setError(getFriendlyRpcErrorMessage(cfgRes.reason, network, "general"));
      } else {
        setConfig(cfgRes.value);
        if (listRes.status === "rejected") {
          setItems([]);
          setError(getFriendlyRpcErrorMessage(listRes.reason, network, "general"));
        } else {
          setItems(listRes.value.items ?? []);
          setError(null);
        }
      }

      if (regRes.status === "fulfilled") {
        setRegistry(regRes.value);
      } else {
        setRegistry(null);
        setRegistryError(
          `${getFriendlyRpcErrorMessage(regRes.reason, network, "general")} Use a node with boing_getQaRegistry or the canonical JSON links.`
        );
      }

      setUpdatedAt(new Date());
    } catch (e) {
      setError(getFriendlyRpcErrorMessage(e, network, "general"));
      setConfig(null);
      setItems([]);
      setRegistry(null);
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useVisibleInterval(() => void load(), autoRefresh ? 45_000 : null);

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
          <li>
            <Link href="/" className="text-network-cyan hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--text-primary)]">QA transparency</li>
        </ol>
      </nav>

      <header>
        <h1 className="page-title font-display">
          QA transparency
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--text-secondary)] leading-relaxed">
          Live pool config, pending queue, and rule registry from public RPC — same methods the explorer uses elsewhere.
          Reviewers with the assigned role can Allow or Reject Unsure deploys in the QA gate below.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          <Link href="/tools/qa-check" className="text-network-cyan hover:underline">
            QA pre-flight
          </Link>{" "}
          (bytecode check)
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            disabled={loading}
            className="rounded-lg bg-network-cyan px-4 py-2 font-semibold text-boing-black hover:bg-network-cyan-light disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh now"}
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              id="qa-auto-refresh"
              name="qa-auto-refresh"
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[var(--border-color)]"
            />
            Auto-refresh every 45s
          </label>
          {updatedAt ? (
            <span className="text-xs text-[var(--text-muted)]">Last updated {updatedAt.toLocaleTimeString()}</span>
          ) : null}
        </div>
      </header>

      {error && (
        <div className="glass-card border-amber-500/40 bg-amber-950/20 p-4 text-amber-200" role="alert">
          {error}
        </div>
      )}

      <section
        aria-labelledby="registry-heading"
        className="glass-card border-2 border-network-cyan/30 bg-gradient-to-br from-boing-navy-mid/95 to-boing-black/90 space-y-5 p-4 shadow-lg shadow-network-cyan/5 sm:p-6"
      >
        <h2 id="registry-heading" className="font-display text-xl font-semibold text-network-cyan">
          Rule registry
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
          From <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">boing_getQaRegistry</code>. Repo JSON is a
          comparison baseline; live networks may differ.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={CANONICAL_QA_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-network-cyan/50 bg-network-cyan/10 px-3 py-2 text-sm font-medium text-network-cyan hover:bg-network-cyan/20"
          >
            Canonical QA config (docs) →
          </a>
          <a
            href={CANONICAL_QA_REGISTRY_JSON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            qa_registry.canonical.json (raw) →
          </a>
          <a
            href={CANONICAL_QA_POOL_CONFIG_JSON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            qa_pool_config.canonical.json (raw) →
          </a>
          <a
            href={RPC_SPEC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            RPC-API-SPEC →
          </a>
        </div>

        {registryError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/25 p-4 text-sm text-amber-100" role="status">
            <p>
              <strong className="text-amber-200">Registry RPC:</strong> {registryError}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-amber-100/85">
              Data comes from the explorer&apos;s RPC URL.{" "}
              <a
                href={QA_RPC_TWO_SURFACES_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-network-cyan underline-offset-2 hover:underline"
              >
                Local vs public RPC
              </a>
            </p>
          </div>
        )}

        {loading && !registry && !registryError ? (
          <div className="h-24 rounded-lg bg-white/5 animate-pulse" aria-busy="true" />
        ) : null}

        {registry ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              <ConfigStat label="Max bytecode" value={`${(registry.max_bytecode_size / 1024).toFixed(0)} KiB`} />
              <ConfigStat label="Bytecode blocklist" value={registry.blocklist?.length ?? 0} hint="32-byte hashes." />
              <ConfigStat label="Scam patterns" value={registry.scam_patterns?.length ?? 0} />
              <ConfigStat
                label="Always-review categories"
                value={registry.always_review_categories?.length ?? 0}
                hint="Purpose categories sent to pool."
              />
              <ConfigStat label="Content blocklist terms" value={registry.content_blocklist?.length ?? 0} hint="Name/symbol filter." />
            </dl>
            <details open className="group rounded-lg border border-[var(--border-color)] bg-boing-black/40">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-white/5">
                Full JSON from <code className="text-network-cyan">boing_getQaRegistry</code>
              </summary>
              <div className="border-t border-[var(--border-color)] p-4 space-y-2">
                <div className="flex justify-end">
                  <CopyButton
                    label="Copy JSON"
                    value={JSON.stringify(registry, null, 2)}
                  />
                </div>
                <pre className="max-h-[min(480px,50vh)] overflow-auto rounded-md bg-boing-black/80 p-4 text-xs text-[var(--text-secondary)] hash">
                  {JSON.stringify(registry, null, 2)}
                </pre>
              </div>
            </details>
          </>
        ) : null}
      </section>

      <section aria-labelledby="pool-live-heading">
        <h2 id="pool-live-heading" className="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">
          Live governance pool ({network})
        </h2>
        {loading && !config ? (
          <div className="glass-card p-8 animate-pulse space-y-4" aria-busy="true">
            <div className="h-24 bg-white/5 rounded" />
            <div className="h-40 bg-white/5 rounded" />
          </div>
        ) : config ? (
          <div className="space-y-6">
            <div
              className={`glass-card p-5 border-l-4 ${
                config.accepts_new_pending
                  ? "border-l-network-cyan"
                  : "border-l-amber-500/70 bg-amber-950/10"
              }`}
            >
              <p className="font-medium text-[var(--text-primary)]">
                Pool:{" "}
                <span className={config.accepts_new_pending ? "text-network-cyan" : "text-amber-200"}>
                  {config.accepts_new_pending ? "Open for new items" : "Closed to new items"}
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                <span className="font-mono text-network-cyan">{config.pending_count}</span> pending · cap{" "}
                <span className="font-mono">{config.max_pending_items}</span> /{" "}
                <span className="font-mono">{config.max_pending_per_deployer}</span> per deployer · window{" "}
                <span className="font-mono">{formatDuration(config.review_window_secs)}</span>
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ConfigStat label="Quorum fraction" value={pct(config.quorum_fraction)} hint="Share of admins that must participate." />
              <ConfigStat
                label="Allow threshold"
                value={pct(config.allow_threshold_fraction)}
                hint="Among voters, allow votes needed to admit."
              />
              <ConfigStat
                label="Reject threshold"
                value={pct(config.reject_threshold_fraction)}
                hint="Among voters, reject votes to dismiss."
              />
              <ConfigStat
                label="On expiry"
                value={<span className="capitalize">{config.default_on_expiry}</span>}
                hint="If review window ends without resolution."
              />
              <ConfigStat
                label="Governance admins"
                value={config.administrator_count}
                hint="Count only; addresses are not listed on RPC."
              />
              <ConfigStat
                label="Dev open voting"
                value={config.dev_open_voting ? "On" : "Off"}
                hint="When on with empty admin list, local-dev style voting may apply."
              />
            </dl>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="qa-gate-heading">
        <h2 id="qa-gate-heading" className="mb-2 font-display text-xl font-semibold text-[var(--text-primary)]">
          QA gate
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-[var(--text-muted)]">
          Automated QA already Allow/Rejects most deploys. Items here are{" "}
          <strong className="text-[var(--text-secondary)]">Unsure</strong> — reviewers given the role vote
          Allow or Reject based on the asset (name, symbol, purpose, bytecode) before it can enter a
          block.{" "}
          <a href={RPC_SPEC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            RPC spec
          </a>
          .
        </p>
        <div className="mb-6">
          <QaReviewerSessionPanel session={session} onSignIn={signIn} onSignOut={signOut} />
        </div>
        {loading && items.length === 0 && !error ? (
          <div className="h-32 glass-card animate-pulse bg-white/5" aria-busy="true" />
        ) : items.length === 0 ? (
          <div className="glass-card p-8 text-center text-[var(--text-muted)]">
            <p>No pending items.</p>
            <p className="mt-2 text-sm">
              <code className="rounded bg-white/10 px-1">-32051</code> deploys show here when referred.
            </p>
          </div>
        ) : (
          <>
            <div className="data-card-list md:hidden">
              {items.map((row) => {
                const deployerPath = hexForLink(row.deployer);
                const txPath = normalizeHex64(row.tx_hash.replace(/^0x/i, ""));
                return (
                  <div key={row.tx_hash} className="data-card space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text-muted)]">Asset</span>
                      <span className="text-sm text-[var(--text-primary)]">
                        {row.asset_name || "Unnamed"}
                        {row.asset_symbol ? (
                          <span className="ml-2 font-mono text-network-cyan">{row.asset_symbol}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Purpose</span>
                      <span className="data-card__value">{row.purpose_category || "—"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text-muted)]">Transaction</span>
                      {txPath ? (
                        <Link
                          href={`/tx/${txPath}?network=${network}`}
                          className="hash text-xs text-network-cyan hover:underline break-all"
                        >
                          {shortenHash(row.tx_hash, 12, 10)}
                        </Link>
                      ) : (
                        <span className="hash text-xs text-[var(--text-secondary)] break-all">
                          {shortenHash(row.tx_hash, 12, 10)}
                        </span>
                      )}
                      <CopyButton value={row.tx_hash} label="Copy tx hash" />
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Bytecode</span>
                      <span className="data-card__value hash text-xs break-all">{shortenHash(row.bytecode_hash, 10, 8)}</span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Deployer</span>
                      <span className="data-card__value">
                        <Link href={explorerAssetHref(deployerPath, network)} className="address-link text-xs">
                          {shortenHash(deployerPath)}
                        </Link>
                      </span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Votes (allow / reject)</span>
                      <span className="data-card__value font-mono">
                        {row.allow_votes} / {row.reject_votes}
                      </span>
                    </div>
                    <div className="data-card__row">
                      <span className="data-card__label">Age</span>
                      <span className="data-card__value">{formatDuration(row.age_secs)}</span>
                    </div>
                    <QaReviewerVoteButtons
                      network={network}
                      txHash={row.tx_hash}
                      session={session}
                      onVoted={() => void load()}
                    />
                  </div>
                );
              })}
            </div>
            <div className="glass-card table-scroll-wrap hidden md:block">
              <p className="table-scroll-hint px-3 pt-3">Swipe horizontally to see all columns</p>
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-muted)]">
                    <th className="p-3 font-medium">Asset</th>
                    <th className="p-3 font-medium">Purpose</th>
                    <th className="p-3 font-medium">Transaction hash</th>
                    <th className="p-3 font-medium">Deployer</th>
                    <th className="p-3 font-medium">Votes</th>
                    <th className="p-3 font-medium">Age</th>
                    <th className="p-3 font-medium">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const deployerPath = hexForLink(row.deployer);
                    const txPath = normalizeHex64(row.tx_hash.replace(/^0x/i, ""));
                    return (
                      <tr key={row.tx_hash} className="border-b border-[var(--border-color)]/60 hover:bg-white/5">
                        <td className="p-3 align-top">
                          <div className="text-[var(--text-primary)]">{row.asset_name || "Unnamed"}</div>
                          <div className="font-mono text-xs text-network-cyan">{row.asset_symbol || "—"}</div>
                        </td>
                        <td className="p-3 align-top text-[var(--text-secondary)]">{row.purpose_category || "—"}</td>
                        <td className="p-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            {txPath ? (
                              <Link
                                href={`/tx/${txPath}?network=${network}`}
                                className="hash text-xs text-network-cyan hover:underline break-all"
                              >
                                {shortenHash(row.tx_hash, 12, 10)}
                              </Link>
                            ) : (
                              <span className="hash text-xs text-[var(--text-secondary)] break-all">
                                {shortenHash(row.tx_hash, 12, 10)}
                              </span>
                            )}
                            <CopyButton value={row.tx_hash} label="Copy tx hash" />
                          </div>
                          <div className="mt-1 hash text-xs text-[var(--text-muted)]">
                            {shortenHash(row.bytecode_hash, 10, 8)}
                          </div>
                        </td>
                        <td className="p-3 align-top">
                          <Link
                            href={explorerAssetHref(deployerPath, network)}
                            className="address-link text-xs"
                          >
                            {shortenHash(deployerPath)}
                          </Link>
                        </td>
                        <td className="p-3 align-top font-mono text-[var(--text-primary)]">
                          {row.allow_votes} / {row.reject_votes}
                        </td>
                        <td className="p-3 align-top text-[var(--text-muted)]">{formatDuration(row.age_secs)}</td>
                        <td className="p-3 align-top">
                          <QaReviewerVoteButtons
                            network={network}
                            txHash={row.tx_hash}
                            session={session}
                            onVoted={() => void load()}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="glass-card space-y-4 p-6" aria-labelledby="qa-reference-heading">
        <h2 id="qa-reference-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
          Reference
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-secondary)]">
          <li>
            <strong className="text-[var(--text-primary)]">Allow</strong> /{" "}
            <strong className="text-[var(--text-primary)]">Reject</strong> /{" "}
            <strong className="text-[var(--text-primary)]">Unsure</strong> — automated path; Unsure may yield pool entry (
            <code className="rounded bg-white/10 px-1">-32051</code>).
          </li>
          <li>
            <Link href="/tools/qa-check" className="text-network-cyan hover:underline">
              QA pre-flight
            </Link>
            {" — "}
            <code className="rounded bg-white/10 px-1">boing_qaCheck</code> dry run.
          </li>
          <li>
            <a href={QA_DOC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
              QA policy
            </a>
            {" · "}
            <a href={RPC_SPEC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
              RPC error codes
            </a>
          </li>
        </ul>
        <details className="rounded-lg border border-[var(--border-color)] bg-boing-black/30">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5">
            QA RPC error code list
          </summary>
          <ul className="divide-y divide-[var(--border-color)]/60 border-t border-[var(--border-color)] px-4 py-2 text-sm">
            {RPC_QA_ERRORS.map((row) => (
              <li key={row.code} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <span className="w-24 shrink-0 font-mono text-network-cyan">{row.code}</span>
                <span className="text-[var(--text-secondary)]">{row.summary}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
