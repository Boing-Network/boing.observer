"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useNetwork } from "@/context/network-context";
import { checkAccountProof, isMethodNotFound, type AccountProofCheck } from "@/lib/account-proof";
import { configuredStorageTreeV2ActivationHeight, describeStorageTree } from "@/lib/storage-tree";
import { isHex64 } from "@/lib/rpc-types";
import { getFriendlyRpcErrorMessage } from "@/lib/rpc-status";
import { CopyButton } from "@/components/copy-button";

export function AccountProofPanel() {
  const { network, ready } = useNetwork();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountProofCheck | null>(null);

  // Prefill from `?address=` (e.g. a link from an account page) once the network is resolved.
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(window.location.search).get("address");
    if (q && isHex64(q)) setAddress(q);
  }, [ready]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!isHex64(address.trim())) {
      setError("Enter a 32-byte account id (64 hex characters, optional 0x).");
      return;
    }
    setBusy(true);
    try {
      setResult(await checkAccountProof(network, address.trim()));
    } catch (err) {
      setError(
        isMethodNotFound(err)
          ? "This RPC does not expose account proofs (older node or filtered gateway)."
          : getFriendlyRpcErrorMessage(err, network, "account"),
      );
    } finally {
      setBusy(false);
    }
  }

  const activation = configuredStorageTreeV2ActivationHeight();

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3" aria-label="Account proof lookup">
        <label htmlFor="proof-address" className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Account id</span>
          <input
            id="proof-address"
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x + 64 hex"
            autoComplete="off"
            spellCheck={false}
            className="hash min-h-10 w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/80 px-3 py-2 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-network-primary focus:outline-none focus:ring-1 focus:ring-network-primary"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-network-cyan hover:border-network-cyan disabled:opacity-50"
          >
            {busy ? "Checking..." : "Fetch & verify proof"}
          </button>
          <span className="text-xs text-[var(--text-muted)]">Network: {network}</span>
        </div>
      </form>

      {error ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      {result ? <ProofResult r={result} activation={activation} /> : null}

      <p className="text-xs leading-relaxed text-[var(--text-muted)]" data-testid="proof-trust-note">
        The node verifies its own proof, so a valid result means the proof is internally consistent and ends at the
        stated root. Matching that root to a block header ties it to chain history; for a trust-minimized check,
        repeat against a second, independent node. {describeStorageTree(result?.headHeight ?? 0, activation)}
      </p>
    </div>
  );
}

function ProofResult({ r, activation }: { r: AccountProofCheck; activation: number | null }) {
  const rows: Array<[string, string, string?]> = [
    ["Account", r.address],
    ["State root", r.root, "Copy state root"],
    ["Value hash", r.valueHash || "-", r.valueHash ? "Copy value hash" : undefined],
    ["Proof", `${r.proofBytes} bytes`],
  ];
  const verifiedText =
    r.nodeVerified === true
      ? "Valid: the node accepts this proof for this root."
      : r.nodeVerified === false
        ? "Invalid: the node rejects this proof for this root."
        : "Not checked: this RPC does not expose boing_verifyAccountProof.";
  const anchorText =
    r.matchedHeight != null
      ? `Root equals the state root of block #${r.matchedHeight}.`
      : `Root does not equal the state root of the newest ${r.inspectedHeights.length} block(s) (#${r.inspectedHeights[r.inspectedHeights.length - 1]} to #${r.headHeight}). The head may have advanced while the proof was built; try again.`;
  const verifiedClass =
    r.nodeVerified === true ? "text-emerald-300" : r.nodeVerified === false ? "text-red-300" : "text-amber-200";
  return (
    <section className="glass-card space-y-3 p-4 sm:p-6" aria-label="Proof result" data-testid="proof-result">
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v, copy]) => (
          <div key={k} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <dt className="text-[var(--text-muted)]">{k}</dt>
            <dd className="hash flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
              <span className="break-all">{v}</span>
              {copy ? <CopyButton value={v} label={copy} /> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className={`text-sm ${verifiedClass}`} data-testid="proof-verified">
        {verifiedText}
      </p>
      <p className="text-sm text-[var(--text-secondary)]" data-testid="proof-anchor">
        {anchorText}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{describeStorageTree(r.headHeight, activation)}</p>
    </section>
  );
}