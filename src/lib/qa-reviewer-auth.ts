/**
 * Voter account helpers for the explorer QA vote proxy.
 * Protocol membership is still enforced by `boing_qaPoolVote` (administrators /
 * `dev_open_voting` / `public_membership`). This layer only validates hex shapes.
 */

const ACCOUNT_HEX = /^[0-9a-f]{64}$/;
const SIGNED_TX_HEX = /^[0-9a-f]+$/;

export function normalizeVoterHex(raw: string): string {
  return raw.trim().replace(/^0x/i, "").toLowerCase();
}

export function isAccountHex(hex: string): boolean {
  return ACCOUNT_HEX.test(hex);
}

/** Bincode `SignedTransaction` hex (optional 0x). Weak length floor; node does full decode. */
export function normalizeSignedTxHex(raw: string): string | null {
  const hex = raw.trim().replace(/^0x/i, "").toLowerCase();
  if (hex.length < 64 || hex.length % 2 !== 0) return null;
  if (!SIGNED_TX_HEX.test(hex)) return null;
  return hex;
}

export function qaPoolVoteRpcParams(
  txHash: string,
  voterHex: string,
  vote: string,
  signedTxHex?: string | null
): string[] {
  const params = [`0x${txHash}`, `0x${voterHex}`, vote];
  if (signedTxHex) params.push(`0x${signedTxHex}`);
  return params;
}
