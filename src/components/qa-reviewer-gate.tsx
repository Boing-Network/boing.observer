"use client";

import { useCallback, useEffect, useState } from "react";
import type { NetworkId } from "@/lib/rpc-types";

const TOKEN_KEY = "boing.observer.qa-reviewer.token";
const VOTER_KEY = "boing.observer.qa-reviewer.voter";

type ReviewerStatus = {
  configured: boolean;
  allowlistConfigured: boolean;
  operatorTokenConfigured: boolean;
};

type VoteKind = "allow" | "reject" | "abstain";

export type QaReviewerSession = {
  ready: boolean;
  configured: boolean;
  allowlistConfigured: boolean;
  token: string;
  voterHex: string;
  signedIn: boolean;
};

export function useQaReviewerSession(): {
  session: QaReviewerSession;
  signIn: (token: string, voterHex: string) => void;
  signOut: () => void;
} {
  const [status, setStatus] = useState<ReviewerStatus | null>(null);
  const [token, setToken] = useState("");
  const [voterHex, setVoterHex] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/qa/reviewer-status")
      .then((r) => r.json() as Promise<ReviewerStatus>)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: false,
            allowlistConfigured: false,
            operatorTokenConfigured: false,
          });
        }
      });
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY) ?? "");
      setVoterHex(sessionStorage.getItem(VOTER_KEY) ?? "");
    } catch {
      /* private mode */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((nextToken: string, nextVoter: string) => {
    setToken(nextToken);
    setVoterHex(nextVoter);
    try {
      sessionStorage.setItem(TOKEN_KEY, nextToken);
      sessionStorage.setItem(VOTER_KEY, nextVoter);
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(() => {
    setToken("");
    setVoterHex("");
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(VOTER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const configured = Boolean(status?.configured);
  const signedIn = configured && token.length >= 8 && voterHex.replace(/^0x/i, "").length === 64;

  return {
    session: {
      ready: status !== null,
      configured,
      allowlistConfigured: Boolean(status?.allowlistConfigured),
      token,
      voterHex,
      signedIn,
    },
    signIn,
    signOut,
  };
}

export function QaReviewerSessionPanel({
  session,
  onSignIn,
  onSignOut,
}: {
  session: QaReviewerSession;
  onSignIn: (token: string, voterHex: string) => void;
  onSignOut: () => void;
}) {
  const [token, setToken] = useState("");
  const [voter, setVoter] = useState("");

  if (!session.ready) {
    return <div className="h-24 rounded-lg bg-white/5 animate-pulse" aria-busy="true" />;
  }

  if (!session.configured) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-boing-black/40 p-4 text-sm text-[var(--text-secondary)]">
        <p>
          Reviewer voting is not enabled on this explorer yet. Operators set{" "}
          <code className="rounded bg-white/10 px-1">QA_REVIEWER_TOKEN</code> and{" "}
          <code className="rounded bg-white/10 px-1">BOING_OPERATOR_RPC_TOKEN</code> on the Worker,
          then give reviewers the shared token plus their 32-byte voter account.
        </p>
      </div>
    );
  }

  if (session.signedIn) {
    const short = session.voterHex.replace(/^0x/i, "");
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-network-cyan/40 bg-network-cyan/10 px-4 py-3">
        <p className="text-sm text-[var(--text-primary)]">
          Reviewer session{" "}
          <span className="font-mono text-network-cyan">
            0x{short.slice(0, 8)}…{short.slice(-6)}
          </span>
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-[var(--border-color)] bg-boing-black/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSignIn(token.trim(), voter.trim());
      }}
    >
      <p className="text-sm text-[var(--text-secondary)]">
        Reviewers given the role can Allow, Reject, or Abstain on Unsure deploys. The vote is
        recorded on the validator QA pool.
        {session.allowlistConfigured
          ? " This explorer also checks an address allowlist."
          : null}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm" htmlFor="qa-reviewer-token">
          <span className="text-[var(--text-muted)]">Reviewer token</span>
          <input
            id="qa-reviewer-token"
            name="qa-reviewer-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/60 px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
            required
          />
        </label>
        <label className="block text-sm" htmlFor="qa-voter-account">
          <span className="text-[var(--text-muted)]">Voter account (32-byte hex)</span>
          <input
            id="qa-voter-account"
            name="qa-voter-account"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={voter}
            onChange={(e) => setVoter(e.target.value)}
            placeholder="0x…"
            className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/60 px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
            required
          />
        </label>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-network-cyan px-4 py-2 font-semibold text-boing-black hover:bg-network-cyan-light"
      >
        Unlock reviewer gate
      </button>
    </form>
  );
}

export function QaReviewerVoteButtons({
  network,
  txHash,
  session,
  onVoted,
}: {
  network: NetworkId;
  txHash: string;
  session: QaReviewerSession;
  onVoted: () => void;
}) {
  const [busy, setBusy] = useState<VoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!session.signedIn) return null;

  async function cast(vote: VoteKind) {
    setBusy(vote);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/qa/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          reviewerToken: session.token,
          voterHex: session.voterHex,
          txHash,
          vote,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        result?: { outcome?: string; mempool?: boolean; duplicate?: boolean };
      };
      if (!res.ok) {
        throw new Error(data.error || `Vote failed (${res.status})`);
      }
      const outcome = data.result?.outcome ?? "pending";
      if (outcome === "allow") {
        setNote(
          data.result?.mempool
            ? "Approved — deploy admitted to the mempool."
            : "Approved."
        );
      } else if (outcome === "reject") {
        setNote("Rejected — this deploy will not be included.");
      } else {
        setNote("Vote recorded. Waiting for quorum.");
      }
      onVoted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void cast("allow")}
          className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-sm font-semibold text-boing-black hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy === "allow" ? "Voting…" : "Allow"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void cast("reject")}
          className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
        >
          {busy === "reject" ? "Voting…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void cast("abstain")}
          className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 disabled:opacity-60"
        >
          {busy === "abstain" ? "Voting…" : "Abstain"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="text-xs text-network-cyan" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
