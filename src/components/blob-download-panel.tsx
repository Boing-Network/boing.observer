"use client";

import { useCallback, useEffect, useState } from "react";
import {
  blobDownloadProofMessageHex,
  buildBlobDownloadProofHeaders,
  clearStoredBlobDownloadToken,
  randomBlobDownloadNonce,
  readStoredBlobDownloadToken,
  storeBlobDownloadToken,
  type PutBlobDownloadHint,
} from "@/lib/blob-download";
import {
  BOING_MAINNET_CHAIN_ID_DECIMAL,
  BOING_TESTNET_CHAIN_ID_DECIMAL,
} from "@/lib/chain-ids";
import {
  ensureWalletChain,
  getBoingProviderWithWebFallback,
  mapWalletErrorToUi,
  walletMissingMessage,
  walletRequestAccounts,
  walletSignMessage,
} from "@/lib/boing-wallet";
import { toPrefixedHex64, type NetworkId } from "@/lib/rpc-types";
import { CopyButton } from "@/components/copy-button";

type AccessState = {
  publisher: string | null;
  grantees: string[];
  epoch: number;
  loading: boolean;
};

function chainIdFor(network: string): number {
  return network === "mainnet" ? BOING_MAINNET_CHAIN_ID_DECIMAL : BOING_TESTNET_CHAIN_ID_DECIMAL;
}

function asNetwork(network: string): NetworkId {
  return network === "mainnet" ? "mainnet" : "testnet";
}

export function BlobDownloadPanel({
  hint,
  network,
}: {
  hint: PutBlobDownloadHint;
  network: string;
}) {
  const [token, setToken] = useState(() => readStoredBlobDownloadToken());
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>({
    publisher: null,
    grantees: [],
    epoch: 0,
    loading: true,
  });
  const [showOperator, setShowOperator] = useState(false);

  const net = asNetwork(network);
  const blobIdPrefixed = toPrefixedHex64(hint.blobId);

  const refreshAccess = useCallback(async () => {
    setAccess((a) => ({ ...a, loading: true }));
    try {
      const res = await fetch(
        `/api/blob/access?network=${encodeURIComponent(network)}&id=${encodeURIComponent(hint.blobId)}`
      );
      if (!res.ok) {
        setAccess({ publisher: null, grantees: [], epoch: 0, loading: false });
        return;
      }
      const j = (await res.json()) as {
        publisher?: string | null;
        grantees?: string[];
        epoch?: number;
      };
      setAccess({
        publisher: typeof j.publisher === "string" ? j.publisher.toLowerCase() : null,
        grantees: Array.isArray(j.grantees)
          ? j.grantees.map((g) => String(g).toLowerCase().replace(/^0x/, ""))
          : [],
        epoch: typeof j.epoch === "number" ? j.epoch : 0,
        loading: false,
      });
    } catch {
      setAccess({ publisher: null, grantees: [], epoch: 0, loading: false });
    }
  }, [hint.blobId, network]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  const accountNorm = account?.toLowerCase().replace(/^0x/, "") ?? null;
  const isPublisher =
    accountNorm != null &&
    access.publisher != null &&
    accountNorm === access.publisher.replace(/^0x/, "");

  async function connectWallet() {
    setError(null);
    try {
      const provider = getBoingProviderWithWebFallback(net);
      if (!provider) throw new Error(walletMissingMessage());
      const accounts = await walletRequestAccounts(provider);
      await ensureWalletChain(provider, net);
      setAccount(accounts[0] ?? null);
    } catch (e) {
      setError(mapWalletErrorToUi(e));
    }
  }

  async function onWalletDownload() {
    setBusy(true);
    setError(null);
    try {
      const provider = getBoingProviderWithWebFallback(net);
      if (!provider) throw new Error(walletMissingMessage());
      let acct = account;
      if (!acct) {
        const accounts = await walletRequestAccounts(provider);
        await ensureWalletChain(provider, net);
        acct = accounts[0] ?? null;
        setAccount(acct);
      } else {
        await ensureWalletChain(provider, net);
      }
      if (!acct) throw new Error("Connect Boing Express to download with a wallet proof.");

      const nonce = randomBlobDownloadNonce();
      const expiresAtUnix = Math.floor(Date.now() / 1000) + 600;
      const messageHex = blobDownloadProofMessageHex({
        chainId: chainIdFor(network),
        blobIdHex: hint.blobId,
        expiresAtUnix,
        nonce,
      });
      const signatureHex = await walletSignMessage(provider, messageHex);
      const proofHeaders = buildBlobDownloadProofHeaders({
        downloaderHex: acct,
        expiresAtUnix,
        nonce,
        signatureHex,
      });

      const url = `/api/blob/download?network=${encodeURIComponent(network)}&id=${encodeURIComponent(hint.blobId)}`;
      const res = await fetch(url, { method: "GET", headers: proofHeaders });
      if (!res.ok) {
        let message = `Download failed (HTTP ${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; hint?: string };
          if (j.error) message = j.error;
          if (j.hint) message = `${message} — ${j.hint}`;
        } catch {
          /* ignore */
        }
        setError(message);
        return;
      }
      await saveBlobResponse(res, hint);
    } catch (e) {
      setError(mapWalletErrorToUi(e));
    } finally {
      setBusy(false);
    }
  }

  async function onOperatorDownload() {
    const t = token.trim();
    if (!t) {
      setError("Enter a download permission token.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (remember) storeBlobDownloadToken(t);
      else clearStoredBlobDownloadToken();

      const url = `/api/blob/download?network=${encodeURIComponent(network)}&id=${encodeURIComponent(hint.blobId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${t}`,
          "X-Boing-Blob-Download": t,
        },
      });
      if (!res.ok) {
        let message = `Download failed (HTTP ${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; hint?: string };
          if (j.error) message = j.error;
          if (j.hint) message = `${message} — ${j.hint}`;
        } catch {
          /* ignore */
        }
        setError(message);
        return;
      }
      await saveBlobResponse(res, hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-500/35 bg-gradient-to-br from-violet-950/30 via-boing-navy-mid/40 to-boing-black/30 p-4 sm:p-5">
      <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-violet-200/90">
        Media blob download
      </h4>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {hint.omitted
          ? "Raw bytes are omitted from this explorer view. Publishers and ACL grantees can download with a wallet signature; operators keep a token override."
          : "Download published media bytes with your wallet (publisher or grantee) or an operator token."}
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Blob id</dt>
          <dd className="font-mono text-[var(--text-secondary)]">{`0x${hint.blobId.slice(0, 10)}…`}</dd>
          <CopyButton value={blobIdPrefixed} label="Copy blob id" />
        </div>
        {hint.size != null ? (
          <div>
            <dt className="inline text-xs uppercase tracking-wide text-[var(--text-muted)]">Size </dt>
            <dd className="inline text-[var(--text-secondary)]">{hint.size.toLocaleString()} bytes</dd>
          </div>
        ) : null}
        {hint.contentType ? (
          <div>
            <dt className="inline text-xs uppercase tracking-wide text-[var(--text-muted)]">Type </dt>
            <dd className="inline font-mono text-[var(--text-secondary)]">{hint.contentType}</dd>
          </div>
        ) : null}
        {!access.loading && access.publisher ? (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Publisher</dt>
            <dd className="font-mono text-[var(--text-secondary)]">
              {`0x${access.publisher.replace(/^0x/, "").slice(0, 10)}…`}
            </dd>
            {access.grantees.length > 0 ? (
              <dd className="text-xs text-[var(--text-muted)]">{access.grantees.length} grantee(s)</dd>
            ) : null}
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!account ? (
          <button
            type="button"
            onClick={() => void connectWallet()}
            className="rounded-md border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/30"
          >
            Connect wallet
          </button>
        ) : (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {`0x${accountNorm?.slice(0, 8)}…`}
            {isPublisher ? " · publisher" : ""}
          </span>
        )}
        <button
          type="button"
          onClick={() => void onWalletDownload()}
          disabled={busy}
          className="rounded-md border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
        >
          {busy ? "Downloading…" : "Download with wallet"}
        </button>
      </div>

      {isPublisher || access.grantees.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-violet-500/20 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Download access
          </p>
          {access.grantees.length > 0 ? (
            <ul className="space-y-1 font-mono text-xs text-[var(--text-muted)]">
              {access.grantees.map((g) => (
                <li key={g}>{`0x${g.slice(0, 12)}…`}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              No extra grantees. Publisher can grant with tx 34 (`GrantBlobDownload`) via SDK /
              Express once wallet support for that type is available.
            </p>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="mt-4 text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-secondary)]"
        onClick={() => setShowOperator((v) => !v)}
      >
        {showOperator ? "Hide" : "Network operator override"}
      </button>
      {showOperator ? (
        <div className="mt-2 space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Download permission token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-[var(--border-color)] bg-boing-black/40 px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-violet-400/60"
              placeholder="Paste token from network operator"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-[var(--border-color)]"
            />
            Remember token for this browser tab
          </label>
          <button
            type="button"
            onClick={() => void onOperatorDownload()}
            disabled={busy}
            className="rounded-md border border-violet-400/40 bg-transparent px-3 py-1.5 text-sm text-violet-100/90 hover:bg-violet-500/15 disabled:opacity-50"
          >
            Download with token
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function saveBlobResponse(res: Response, hint: PutBlobDownloadHint) {
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] || `boing-blob-${hint.blobId.slice(0, 8)}.bin`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
