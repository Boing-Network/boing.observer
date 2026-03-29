"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNetwork } from "@/context/network-context";
import { CopyButton } from "@/components/copy-button";
import {
  CANONICAL_QA_DOC_URL,
  CANONICAL_QA_POOL_CONFIG_JSON_URL,
  CANONICAL_QA_REGISTRY_JSON_URL,
  QA_DOC_URL,
  RPC_SPEC_URL,
} from "@/lib/constants";
import { fetchQaPoolConfig, fetchQaPoolList, fetchQaRegistry } from "@/lib/rpc-methods";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import type { QaPoolConfigResult, QaPoolItemSummary, QaRegistryResult } from "@/lib/rpc-types";
import { hexForLink, shortenHash } from "@/lib/rpc-types";

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
          `${getFriendlyRpcErrorMessage(regRes.reason, network, "general")} If the node is older than the release with ` +
            `\`boing_getQaRegistry\`, upgrade the RPC or compare against the canonical JSON in docs instead.`
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

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => void load(), 45_000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  return (
    <div className="space-y-10 max-w-5xl">
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Quality assurance — public transparency
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] leading-relaxed max-w-3xl">
          Boing enforces protocol QA on every contract deployment. This page reads the same public JSON-RPC as the rest of
          the explorer: live <strong className="text-[var(--text-primary)]">governance pool parameters</strong>, the{" "}
          <strong className="text-[var(--text-primary)]">pending review queue</strong>, and per-item vote tallies. Nothing here
          is hidden behind a private API—verify the data against your own node or{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">boing_qaPoolList</code> /{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">boing_qaPoolConfig</code> /{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">boing_getQaRegistry</code>.
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
        className="glass-card border-2 border-network-cyan/30 bg-gradient-to-br from-boing-navy-mid/95 to-boing-black/90 p-6 space-y-5 shadow-lg shadow-network-cyan/5"
      >
        <h2 id="registry-heading" className="font-display text-xl font-semibold text-network-cyan">
          Protocol rule registry — live JSON and canonical baseline
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl">
          The table below is the exact <strong className="text-[var(--text-primary)]">RuleRegistry</strong> your selected RPC
          uses for bytecode and purpose checks. It is returned by read-only{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">boing_getQaRegistry</code> (same shape as{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">qa_registry.json</code> on the node).{" "}
          <strong className="text-[var(--text-primary)]">Canonical JSON</strong> in the Boing repo is a documented default for
          comparison only — production networks may differ after governance.
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
            <strong className="text-amber-200">Registry RPC:</strong> {registryError}
          </div>
        )}

        {loading && !registry && !registryError ? (
          <div className="h-24 rounded-lg bg-white/5 animate-pulse" aria-busy="true" />
        ) : null}

        {registry ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                Pool status:{" "}
                <span className={config.accepts_new_pending ? "text-network-cyan" : "text-amber-200"}>
                  {config.accepts_new_pending ? "Accepting new pending items (when rules allow)" : "Not accepting new pending items"}
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                <span className="font-mono text-network-cyan">{config.pending_count}</span> pending now · cap{" "}
                <span className="font-mono">{config.max_pending_items}</span> global ·{" "}
                <span className="font-mono">{config.max_pending_per_deployer}</span> per deployer · review window{" "}
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

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="font-display text-xl font-semibold text-[var(--text-primary)] mb-2">
          Pending queue
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Each row is a deployment classified <strong className="text-[var(--text-secondary)]">Unsure</strong> by protocol QA,
          waiting for governance. Vote counts are public; casting votes uses operator tooling (see{" "}
          <a href={RPC_SPEC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            RPC spec
          </a>
          ).
        </p>
        {loading && items.length === 0 && !error ? (
          <div className="h-32 glass-card animate-pulse bg-white/5" aria-busy="true" />
        ) : items.length === 0 ? (
          <div className="glass-card p-8 text-center text-[var(--text-muted)]">
            <p>No pending items in the pool right now.</p>
            <p className="mt-2 text-sm">When deploys are referred with <code className="rounded bg-white/10 px-1">-32051</code>, they appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto glass-card">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-[var(--text-muted)]">
                  <th className="p-3 font-medium">Transaction hash</th>
                  <th className="p-3 font-medium">Bytecode hash</th>
                  <th className="p-3 font-medium">Deployer</th>
                  <th className="p-3 font-medium">Votes (allow / reject)</th>
                  <th className="p-3 font-medium">Age</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const deployerPath = hexForLink(row.deployer);
                  return (
                    <tr key={row.tx_hash} className="border-b border-[var(--border-color)]/60 hover:bg-white/5">
                      <td className="p-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="hash text-xs text-[var(--text-secondary)] break-all">{shortenHash(row.tx_hash, 12, 10)}</span>
                          <CopyButton value={row.tx_hash} label="Copy tx hash" />
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <span className="hash text-xs text-[var(--text-muted)] break-all">{shortenHash(row.bytecode_hash, 10, 8)}</span>
                      </td>
                      <td className="p-3 align-top">
                        <Link
                          href={`/account/${deployerPath}?network=${network}`}
                          className="address-link text-xs"
                        >
                          {shortenHash(deployerPath)}
                        </Link>
                      </td>
                      <td className="p-3 align-top font-mono text-[var(--text-primary)]">
                        {row.allow_votes} / {row.reject_votes}
                      </td>
                      <td className="p-3 align-top text-[var(--text-muted)]">{formatDuration(row.age_secs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-network-cyan">Protocol path (Allow / Reject / Unsure)</h2>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-secondary)] text-sm leading-relaxed">
            <li>
              <strong className="text-[var(--text-primary)]">Allow</strong> — deployment meets automated rules; it can proceed.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Reject</strong> — blocked with structured feedback (e.g.{" "}
              <code className="rounded bg-white/10 px-1">rule_id</code>).
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Unsure</strong> — needs human governance review; may enter this pool
              (see error <code className="rounded bg-white/10 px-1">-32051</code> on submit).
            </li>
          </ul>
          <p className="text-sm">
            <a href={QA_DOC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
              Full QA design &amp; malice definition →
            </a>
          </p>
        </div>
        <div className="glass-card p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-network-cyan">Try pre-flight QA</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Before spending gas, run bytecode through the same <code className="rounded bg-white/10 px-1">boing_qaCheck</code>{" "}
            logic the node uses for a dry run (allow / reject / unsure).
          </p>
          <Link
            href="/tools/qa-check"
            className="inline-flex font-medium text-network-cyan hover:text-network-cyan-light"
          >
            Open QA Check tool →
          </Link>
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-3">
          QA-related RPC errors (transparency)
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Wallets and dApps surface these codes when submitting deploys. Source:{" "}
          <a href={RPC_SPEC_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
            RPC-API-SPEC.md
          </a>
          .
        </p>
        <ul className="divide-y divide-[var(--border-color)]/60 text-sm">
          {RPC_QA_ERRORS.map((row) => (
            <li key={row.code} className="py-2.5 flex flex-col sm:flex-row sm:gap-4">
              <span className="font-mono text-network-cyan shrink-0 w-24">{row.code}</span>
              <span className="text-[var(--text-secondary)]">{row.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
