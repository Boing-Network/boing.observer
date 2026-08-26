"use client";

import { useCallback, useEffect, useState } from "react";
import { NETWORK_FAUCET_URL, WALLET_URL } from "@/lib/constants";
import { useNetwork } from "@/context/network-context";
import {
  chainIdHexForNetwork,
  ensureWalletChain,
  firstAccountHex,
  getInjectedBoingProvider,
  isQaPoolVoteUnsupported,
  isWalletUserRejected,
  mapWalletErrorToUi,
  qaPoolVoteTxRequest,
  walletAccounts,
  walletChainIdHex,
  walletRequestAccounts,
  walletSendTransaction,
  walletSignTransaction,
  type BoingInjectedProvider,
} from "@/lib/boing-wallet";
import { isAccountHex, normalizeVoterHex } from "@/lib/qa-reviewer-auth";
import type { NetworkId } from "@/lib/rpc-types";

const VOTER_KEY = "boing.observer.qa-voter.account";
const SOURCE_KEY = "boing.observer.qa-voter.source";

type VoteStatus = {
  configured: boolean;
  publicVoting: boolean;
  operatorTokenConfigured: boolean;
};

type VoteKind = "allow" | "reject" | "abstain";
type VoterSource = "wallet" | "manual";

export type QaReviewerSession = {
  ready: boolean;
  configured: boolean;
  publicVoting: boolean;
  operatorTokenConfigured: boolean;
  voterHex: string;
  signedIn: boolean;
  walletDetected: boolean;
  viaWallet: boolean;
  chainMismatch: boolean;
  expectedChainId: string;
  walletChainId: string | null;
};

function persistVoter(hex: string, source: VoterSource) {
  try {
    sessionStorage.setItem(VOTER_KEY, hex);
    sessionStorage.setItem(SOURCE_KEY, source);
  } catch {
    /* private mode */
  }
}

function clearPersistedVoter() {
  try {
    sessionStorage.removeItem(VOTER_KEY);
    sessionStorage.removeItem(SOURCE_KEY);
  } catch {
    /* ignore */
  }
}

export function useQaReviewerSession(): {
  session: QaReviewerSession;
  signIn: (voterHex: string, source?: VoterSource) => void;
  signOut: () => void;
  connectWallet: () => Promise<void>;
  switchWalletChain: () => Promise<void>;
} {
  const { network } = useNetwork();
  const [status, setStatus] = useState<VoteStatus | null>(null);
  const [voterHex, setVoterHex] = useState("");
  const [source, setSource] = useState<VoterSource | null>(null);
  const [walletDetected, setWalletDetected] = useState(false);
  const [walletChainId, setWalletChainId] = useState<string | null>(null);

  const expectedChainId = chainIdHexForNetwork(network).toLowerCase();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/qa/reviewer-status")
      .then((r) => r.json() as Promise<VoteStatus>)
      .then((s) => {
        if (!cancelled) {
          setStatus({
            configured: s.configured !== false,
            publicVoting: s.publicVoting !== false,
            operatorTokenConfigured: Boolean(s.operatorTokenConfigured),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            configured: true,
            publicVoting: true,
            operatorTokenConfigured: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAccounts = useCallback((accounts: string[], nextSource: VoterSource) => {
    const hex = firstAccountHex(accounts);
    if (!hex) {
      setVoterHex("");
      setSource(null);
      clearPersistedVoter();
      return;
    }
    setVoterHex(hex);
    setSource(nextSource);
    persistVoter(hex, nextSource);
  }, []);

  useEffect(() => {
    const provider = getInjectedBoingProvider();
    setWalletDetected(Boolean(provider));
    if (!provider) {
      try {
        const stored = sessionStorage.getItem(VOTER_KEY) ?? "";
        const storedSource = sessionStorage.getItem(SOURCE_KEY);
        const hex = normalizeVoterHex(stored);
        if (isAccountHex(hex) && storedSource !== "wallet") {
          setVoterHex(hex);
          setSource("manual");
        }
      } catch {
        /* private mode */
      }
      return;
    }

    let cancelled = false;
    const onAccounts = (...args: unknown[]) => {
      const raw = args[0];
      const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
      applyAccounts(list, "wallet");
    };

    void (async () => {
      try {
        const [accounts, chainId] = await Promise.all([
          walletAccounts(provider),
          walletChainIdHex(provider).catch(() => null),
        ]);
        if (cancelled) return;
        setWalletChainId(chainId);
        if (accounts.length > 0) {
          applyAccounts(accounts, "wallet");
          return;
        }
        try {
          const stored = sessionStorage.getItem(VOTER_KEY) ?? "";
          const storedSource = sessionStorage.getItem(SOURCE_KEY);
          const hex = normalizeVoterHex(stored);
          if (isAccountHex(hex) && storedSource === "manual") {
            setVoterHex(hex);
            setSource("manual");
          }
        } catch {
          /* private mode */
        }
      } catch {
        /* ignore */
      }
    })();

    provider.on?.("accountsChanged", onAccounts);
    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged", onAccounts);
    };
  }, [applyAccounts]);

  const signIn = useCallback((nextVoter: string, nextSource: VoterSource = "manual") => {
    const hex = normalizeVoterHex(nextVoter);
    if (!isAccountHex(hex)) return;
    setVoterHex(hex);
    setSource(nextSource);
    persistVoter(hex, nextSource);
  }, []);

  const signOut = useCallback(() => {
    setVoterHex("");
    setSource(null);
    clearPersistedVoter();
  }, []);

  const connectWallet = useCallback(async () => {
    const provider = getInjectedBoingProvider();
    if (!provider) {
      throw new Error("Boing Express is not installed in this browser.");
    }
    const accounts = await walletRequestAccounts(provider);
    await ensureWalletChain(provider, network);
    const chainId = await walletChainIdHex(provider).catch(() => null);
    setWalletChainId(chainId);
    applyAccounts(accounts, "wallet");
  }, [applyAccounts, network]);

  const switchWalletChain = useCallback(async () => {
    const provider = getInjectedBoingProvider();
    if (!provider) throw new Error("Boing Express is not installed in this browser.");
    await ensureWalletChain(provider, network);
    const chainId = await walletChainIdHex(provider).catch(() => null);
    setWalletChainId(chainId);
  }, [network]);

  const configured = status !== null ? status.configured : false;
  const signedIn = configured && isAccountHex(normalizeVoterHex(voterHex));
  const viaWallet = signedIn && source === "wallet";
  const chainMismatch = viaWallet && walletChainId !== null && walletChainId !== expectedChainId;

  return {
    session: {
      ready: status !== null,
      configured,
      publicVoting: Boolean(status?.publicVoting),
      operatorTokenConfigured: Boolean(status?.operatorTokenConfigured),
      voterHex,
      signedIn,
      walletDetected,
      viaWallet,
      chainMismatch,
      expectedChainId,
      walletChainId,
    },
    signIn,
    signOut,
    connectWallet,
    switchWalletChain,
  };
}

export function QaReviewerSessionPanel({
  session,
  onSignIn,
  onSignOut,
  onConnectWallet,
  onSwitchChain,
}: {
  session: QaReviewerSession;
  onSignIn: (voterHex: string) => void;
  onSignOut: () => void;
  onConnectWallet: () => Promise<void>;
  onSwitchChain: () => Promise<void>;
}) {
  const [voter, setVoter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!session.ready) {
    return <div className="h-24 rounded-lg bg-white/5 animate-pulse" aria-busy="true" />;
  }

  if (!session.configured) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-boing-black/40 p-4 text-sm text-[var(--text-secondary)]">
        <p>Public voting is not available on this explorer yet.</p>
      </div>
    );
  }

  if (session.signedIn) {
    const short = session.voterHex.replace(/^0x/i, "");
    return (
      <div className="space-y-3 rounded-lg border border-network-cyan/40 bg-network-cyan/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-primary)]">
            Voting as{" "}
            <span className="font-mono text-network-cyan">
              0x{short.slice(0, 8)}…{short.slice(-6)}
            </span>
            {session.viaWallet ? (
              <span className="ml-2 text-xs text-[var(--text-muted)]">via Boing Express</span>
            ) : (
              <span className="ml-2 text-xs text-amber-200">unsigned (no treasury reward)</span>
            )}
          </p>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            Disconnect
          </button>
        </div>
        {session.viaWallet ? (
          <p className="text-xs text-[var(--text-muted)]">
            Counted Allow/Reject votes earn a protocol treasury reward (typically 1 BOING) when the
            signed vote is included. Abstain does not pay by default. Votes spend a small amount of
            gas — use the{" "}
            <a href={NETWORK_FAUCET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
              testnet faucet
            </a>{" "}
            if needed.
          </p>
        ) : (
          <p className="text-xs text-amber-200">
            Paste-hex votes are recorded on the pool when the node allows unsigned RPC votes. They
            do not pay treasury rewards. Connect Boing Express to vote on-chain.
          </p>
        )}
        {session.chainMismatch ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
            <span>
              Wallet is on {session.walletChainId ?? "another chain"}; this page uses{" "}
              {session.expectedChainId}.
            </span>
            <button
              type="button"
              onClick={() => void onSwitchChain().catch((e) => setFormError(mapWalletErrorToUi(e)))}
              className="rounded-md border border-amber-400/50 px-2 py-1 text-amber-100 hover:bg-amber-950/40"
            >
              Switch network
            </button>
          </div>
        ) : null}
        {formError ? (
          <p className="text-xs text-rose-300" role="alert">
            {formError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-color)] bg-boing-black/40 p-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Connect{" "}
        <a href={WALLET_URL} target="_blank" rel="noopener noreferrer" className="text-network-cyan hover:underline">
          Boing Express
        </a>{" "}
        to Allow, Reject, or Abstain on Unsure deploys. Signed votes can earn on-chain treasury
        rewards. No reviewer code is required.
      </p>
      {!session.operatorTokenConfigured ? (
        <p className="text-xs text-amber-200">
          This explorer has no operator RPC token set. If the validator requires{" "}
          <code className="rounded bg-white/10 px-1">X-Boing-Operator</code>, unsigned fallback votes
          will fail until operators add{" "}
          <code className="rounded bg-white/10 px-1">BOING_OPERATOR_RPC_TOKEN</code>.
        </p>
      ) : null}
      {session.walletDetected ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setFormError(null);
            void onConnectWallet()
              .catch((e) => setFormError(mapWalletErrorToUi(e)))
              .finally(() => setBusy(false));
          }}
          className="rounded-lg bg-network-cyan px-4 py-2 font-semibold text-boing-black hover:bg-network-cyan-light disabled:opacity-60"
        >
          {busy ? "Connecting…" : "Connect Boing Express"}
        </button>
      ) : (
        <a
          href={WALLET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg bg-network-cyan px-4 py-2 font-semibold text-boing-black hover:bg-network-cyan-light"
        >
          Install Boing Express
        </a>
      )}
      {formError ? (
        <p className="text-xs text-rose-300" role="alert">
          {formError}
        </p>
      ) : null}
      <button
        type="button"
        className="text-xs text-[var(--text-muted)] hover:text-network-cyan"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Hide unsigned fallback" : "Advanced: vote without a wallet (no reward)"}
      </button>
      {showAdvanced ? (
        <form
          className="space-y-3 border-t border-[var(--border-color)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const hex = normalizeVoterHex(voter);
            if (!isAccountHex(hex)) {
              setFormError("Enter a 32-byte account id (64 hex characters).");
              return;
            }
            setFormError(null);
            onSignIn(hex);
          }}
        >
          <label className="block text-sm" htmlFor="qa-voter-account">
            <span className="text-[var(--text-muted)]">Voter account (32-byte hex)</span>
            <input
              id="qa-voter-account"
              name="qa-voter-account"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={voter}
              onChange={(e) => {
                setVoter(e.target.value);
                setFormError(null);
              }}
              placeholder="0x…"
              className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-boing-navy-mid/60 px-3 py-2 font-mono text-sm text-[var(--text-primary)]"
              required
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:border-network-cyan/50 hover:text-[var(--text-primary)]"
          >
            Start unsigned voting
          </button>
        </form>
      ) : null}
    </div>
  );
}

function noteFromOutcome(outcome: string | undefined, mempool: boolean | undefined, rewarded: boolean): string {
  const pay = rewarded
    ? " Counted Allow/Reject votes earn treasury rewards when included."
    : " Unsigned votes do not earn treasury rewards.";
  if (outcome === "allow") {
    return (mempool ? "Approved — deploy admitted to the mempool." : "Approved.") + pay;
  }
  if (outcome === "reject") {
    return "Rejected — this deploy will not be included." + pay;
  }
  return "Vote recorded. Waiting for quorum." + pay;
}

async function submitSignedVoteViaWallet(
  provider: BoingInjectedProvider,
  network: NetworkId,
  voterHex: string,
  txHash: string,
  vote: VoteKind
): Promise<{ note: string }> {
  await ensureWalletChain(provider, network);
  const tx = qaPoolVoteTxRequest(txHash, vote);
  try {
    const hash = await walletSendTransaction(provider, tx);
    return {
      note: `Vote submitted (${hash.slice(0, 12)}…). Counted Allow/Reject votes earn treasury rewards when included.`,
    };
  } catch (sendErr) {
    if (isWalletUserRejected(sendErr) || isQaPoolVoteUnsupported(sendErr)) throw sendErr;
    const signed = await walletSignTransaction(provider, tx);
    const res = await fetch("/api/qa/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network,
        voterHex,
        txHash,
        vote,
        signedTxHex: signed,
      }),
    });
    const data = (await res.json()) as { error?: string; result?: { outcome?: string; mempool?: boolean } };
    if (!res.ok) {
      throw new Error(data.error || (sendErr instanceof Error ? sendErr.message : `Vote failed (${res.status})`));
    }
    return { note: noteFromOutcome(data.result?.outcome, data.result?.mempool, true) };
  }
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
      if (session.viaWallet) {
        const provider = getInjectedBoingProvider();
        if (!provider) {
          throw new Error("Boing Express is no longer available. Reconnect the wallet.");
        }
        const { note: next } = await submitSignedVoteViaWallet(
          provider,
          network,
          session.voterHex,
          txHash,
          vote
        );
        setNote(next);
        onVoted();
        return;
      }

      const res = await fetch("/api/qa/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
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
      setNote(noteFromOutcome(data.result?.outcome, data.result?.mempool, false));
      onVoted();
    } catch (e) {
      setError(mapWalletErrorToUi(e));
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
