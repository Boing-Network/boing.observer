"use client";

type Props = {
  variant?: "by-hash" | "by-height";
};

/**
 * Clarifies Boing L1 block model: block hash ≠ EVM tx hash; txs live inside the block.
 */
export function BlockExplainerBanner({ variant = "by-hash" }: Props) {
  const isHash = variant === "by-hash";
  return (
    <aside
      className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 text-sm text-[var(--text-secondary)] space-y-2"
      aria-label="How Boing blocks work"
    >
      <p className="font-medium text-[var(--text-primary)]">
        {isHash
          ? "This page is a block — not an Ethereum-style transaction receipt"
          : "How to read this block"}
      </p>
      <ul className="list-disc pl-5 space-y-1.5 text-[13px] leading-relaxed">
        {isHash ? (
          <li>
            The 64-character value above is the block&apos;s <strong>BLAKE3 block hash</strong>. Wallets
            sometimes prefix it with <code className="text-network-cyan">0x</code>; that is still the
            same block id, <strong>not</strong> a separate &quot;transaction hash&quot; on Boing L1.
          </li>
        ) : null}
        <li>
          Everything that changed state (faucet, transfers, staking, …) is listed under{" "}
          <strong>Transactions</strong> below. Boing does not yet expose{" "}
          <code className="rounded bg-white/10 px-1">boing_getTransactionByHash</code> — find activity by
          block height/hash or account.
        </li>
        <li>
          Amounts are in whole <strong>BOING</strong> (same units as the node RPC). A typical faucet drip is{" "}
          <strong>1,000 BOING</strong> in one transfer.
        </li>
        <li>
          To verify a drip, search the explorer for your <strong>64-character account id</strong> (hex
          public key) and open the account page to see the updated balance.
        </li>
      </ul>
    </aside>
  );
}
