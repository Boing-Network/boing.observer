"use client";

import { useState } from "react";
import {
  clearStoredBlobDownloadToken,
  readStoredBlobDownloadToken,
  storeBlobDownloadToken,
  type PutBlobDownloadHint,
} from "@/lib/blob-download";
import { toPrefixedHex64 } from "@/lib/rpc-types";
import { CopyButton } from "@/components/copy-button";

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

  async function onDownload() {
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
          ? "Raw bytes are omitted from this explorer view (public RPC size limit)."
          : "Raw media bytes for this blob."}{" "}
        Download today requires a <span className="text-[var(--text-primary)]">network operator</span>{" "}
        permission token (Fly / explorer Worker secret — not issued per blob). Deployer-owned
        grant/revoke access is planned next.
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Blob id</dt>
          <dd className="font-mono text-[var(--text-secondary)]">{`0x${hint.blobId.slice(0, 10)}…`}</dd>
          <CopyButton value={toPrefixedHex64(hint.blobId)} label="Copy blob id" />
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
      </dl>

      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Operator download token
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-[var(--border-color)] bg-boing-black/40 px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-violet-400/60"
          placeholder="BOING_OPERATOR_RPC_TOKEN or BOING_BLOB_DOWNLOAD_TOKENS entry"
        />
      </label>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
        Ask a Boing Network operator for the shared secret, or use the value from Fly secrets /
        the explorer Worker if you operate the node. Blob publishers cannot mint this token yet.
      </p>
      <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="rounded border-[var(--border-color)]"
        />
        Remember token for this browser tab
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={busy}
          className="rounded-md border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
        >
          {busy ? "Downloading…" : "Download blob"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
