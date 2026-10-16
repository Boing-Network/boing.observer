"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContractInterfaceResponse } from "@/app/api/contract/interface/route";
import { encodeContractCall, returnWords, wordAsUint } from "@/lib/contract-call-encode";
import { formatSelector, type ContractFunction } from "@/lib/contract-interfaces";
import { explorerAccountHref, explorerBlockHeightHref } from "@/lib/explorer-href";
import { getRpcBaseUrl, rpcCall } from "@/lib/rpc-client";
import type { NetworkId } from "@/lib/rpc-types";
import { shortenHash } from "@/lib/rpc-types";

const SOURCE_LABEL: Record<ContractInterfaceResponse["source"], string> = {
  canonical: "Canonical deployment",
  bytecode: "Exact bytecode match with a canonical template",
  selectors: "Selectors decoded from bytecode",
  none: "Unknown",
};

type SimResult = { success?: boolean; return_data?: string; error?: string; gas_used?: number | string };

function ReadCall({ fn, network, address64 }: { fn: ContractFunction; network: NetworkId; address64: string }) {
  const [values, setValues] = useState<string[]>(() => fn.params.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [words, setWords] = useState<string[] | null>(null);

  const run = async () => {
    setErr(null);
    setWords(null);
    let calldata: string;
    try {
      calldata = encodeContractCall(fn.selector, fn.params, values);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    setBusy(true);
    try {
      const r = await rpcCall<SimResult>(network, getRpcBaseUrl(network), "boing_simulateContractCall", [
        `0x${address64}`,
        calldata,
        null,
      ]);
      if (r.success === false) setErr(r.error || "The call failed (no return data).");
      else setWords(returnWords(r.return_data));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-[var(--border-color)] bg-black/20 p-3" data-testid={`contract-fn-query-${fn.name}`}>
      {fn.params.map((p, i) => (
        <label key={p.name} className="block text-xs text-[var(--text-muted)]">
          {p.name} <span className="font-mono">({p.type})</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border-color)] bg-black/30 px-2 py-1 font-mono text-sm text-[var(--text-primary)]"
            value={values[i]}
            placeholder={p.type === "account" || p.type === "bytes32" ? "0x… (64 hex)" : "0"}
            onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            data-testid={`contract-fn-input-${fn.name}-${p.name}`}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded-md bg-network-cyan/20 px-3 py-1 text-sm font-medium text-network-cyan hover:bg-network-cyan/30 disabled:opacity-50"
        data-testid={`contract-fn-run-${fn.name}`}
      >
        {busy ? "Querying…" : "Query (simulated, no transaction)"}
      </button>
      {err ? <p className="text-sm text-amber-300" role="alert">{err}</p> : null}
      {words ? (
        <ol className="space-y-1 text-xs" data-testid={`contract-fn-result-${fn.name}`}>
          {words.length === 0 ? <li className="text-[var(--text-muted)]">No return data.</li> : null}
          {words.map((w, i) => {
            const n = wordAsUint(w);
            return (
              <li key={i} className="font-mono break-all">
                <span className="text-[var(--text-muted)]">word {i}: </span>
                {n != null ? <span className="text-network-cyan">{n}</span> : (
                  <Link href={explorerAccountHref(w, network)} className="text-network-cyan hover:underline">0x{w}</Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function FunctionRow({ fn, network, address64 }: { fn: ContractFunction; network: NetworkId; address64: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-[var(--border-color)] py-3 first:border-t-0" data-testid="contract-fn">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm font-semibold text-[var(--text-primary)]" data-testid="contract-fn-name">
          {fn.name}({fn.params.map((p) => `${p.name}: ${p.type}`).join(", ")})
        </code>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">{formatSelector(fn.selector)}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${fn.kind === "read" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
          data-testid="contract-fn-kind"
        >
          {fn.kind === "read" ? "Read" : "Write"}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{fn.description}</p>
      <dl className="mt-1 grid gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)] sm:grid-cols-[auto_1fr]">
        <dt>Who can call</dt>
        <dd className="text-[var(--text-secondary)]">{fn.access}</dd>
        {fn.returns ? (<><dt>Returns</dt><dd className="text-[var(--text-secondary)]">{fn.returns}</dd></>) : null}
        {fn.layout ? (<><dt>Calldata</dt><dd className="font-mono text-[var(--text-secondary)]">{fn.layout}</dd></>) : null}
        {fn.params.some((p) => p.note) ? (
          <>
            <dt>Notes</dt>
            <dd className="text-[var(--text-secondary)]">{fn.params.filter((p) => p.note).map((p) => `${p.name}: ${p.note}`).join("; ")}</dd>
          </>
        ) : null}
      </dl>
      {fn.kind === "read" ? (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-xs text-network-cyan hover:underline" data-testid={`contract-fn-toggle-${fn.name}`}>
            {open ? "Hide query" : "Query this function"}
          </button>
          {open ? <ReadCall fn={fn} network={network} address64={address64} /> : null}
        </>
      ) : null}
    </li>
  );
}

/** Contract pages: every function the contract can perform (known template ABI, or decoded selectors). */
export function ContractFunctions({ network, address64 }: { network: NetworkId; address64: string }) {
  const [data, setData] = useState<ContractInterfaceResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    fetch(`/api/contract/interface?network=${network}&id=0x${address64}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ContractInterfaceResponse) => live && setData(j))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [network, address64]);

  if (failed) return null;
  if (!data) {
    return <div className="h-24 animate-pulse rounded bg-white/5" aria-busy="true" data-testid="contract-functions-loading" />;
  }
  const isContract = data.source !== "none" || data.decodedSelectors.length > 0 || data.calledAsContract || data.code != null;
  if (!isContract) return null;

  const reads = data.functions.filter((f) => f.kind === "read").length;
  return (
    <section className="space-y-3" aria-labelledby="contract-functions-heading" data-testid="contract-functions">
      <h2 id="contract-functions-heading" className="font-display text-lg font-semibold text-[var(--text-primary)]">
        Contract functions
      </h2>
      <div className="glass-card space-y-3 p-4 sm:p-6">
        <div className="space-y-1">
          <p className="font-medium text-[var(--text-primary)]" data-testid="contract-interface-label">
            {data.label ?? "Unrecognised contract"}
          </p>
          {data.summary ? <p className="text-sm text-[var(--text-secondary)]">{data.summary}</p> : null}
          <p className="text-xs text-[var(--text-muted)]" data-testid="contract-interface-source">
            Identified by: {SOURCE_LABEL[data.source]}
            {data.docsUrl ? (
              <>
                {" · "}
                <a href={data.docsUrl} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">spec</a>
              </>
            ) : null}
          </p>
          {data.code ? (
            <p className="text-xs text-[var(--text-muted)]" data-testid="contract-code-info">
              Deployed by{" "}
              <Link href={explorerAccountHref(data.code.deployer, network)} className="font-mono text-network-cyan hover:underline">
                {shortenHash(`0x${data.code.deployer}`)}
              </Link>{" "}
              in{" "}
              <Link href={explorerBlockHeightHref(data.code.height, network, data.code.txIndex)} className="text-network-cyan hover:underline">
                block #{data.code.height}
              </Link>{" "}
              · {data.code.sizeBytes.toLocaleString()} bytes · {data.decodedSelectors.length} dispatch selector
              {data.decodedSelectors.length === 1 ? "" : "s"} decoded
            </p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Deploy bytecode not located from account history, so selectors were not decoded.</p>
          )}
          {data.notes.map((n) => (
            <p key={n} className="text-xs text-[var(--text-muted)]">{n}</p>
          ))}
        </div>

        {data.functions.length > 0 ? (
          <>
            <p className="text-xs text-[var(--text-muted)]">
              {data.functions.length} function{data.functions.length === 1 ? "" : "s"} ({reads} read, {data.functions.length - reads} write). Calldata: selector in the low byte of word 0, then one 32-byte word per parameter.
            </p>
            <ul data-testid="contract-fn-list">
              {data.functions.map((fn) => (
                <FunctionRow key={`${fn.selector}-${fn.name}`} fn={fn} network={network} address64={data.address} />
              ))}
            </ul>
          </>
        ) : null}

        {data.unknownSelectors.length > 0 ? (
          <div data-testid="contract-unknown-selectors">
            <p className="text-sm font-medium text-[var(--text-primary)]">Unknown function selectors</p>
            <p className="text-xs text-[var(--text-muted)]">The bytecode dispatches on these selectors, but no published interface names them.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {data.unknownSelectors.map((s) => (
                <li key={s} className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">{formatSelector(s)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.functions.length === 0 && data.unknownSelectors.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            No interface is known for this contract and its dispatch could not be decoded.
          </p>
        ) : null}
      </div>
    </section>
  );
}