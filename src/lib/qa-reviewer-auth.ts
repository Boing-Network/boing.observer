/**
 * Voter account helpers for the explorer QA vote proxy.
 * Protocol membership is still enforced by `boing_qaPoolVote` (administrators /
 * `dev_open_voting`). This layer only validates a 32-byte account id.
 */

const ACCOUNT_HEX = /^[0-9a-f]{64}$/;

export function normalizeVoterHex(raw: string): string {
  return raw.trim().replace(/^0x/i, "").toLowerCase();
}

export function isAccountHex(hex: string): boolean {
  return ACCOUNT_HEX.test(hex);
}
