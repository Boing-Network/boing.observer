/**
 * Server-side gates for the observer QA reviewer role.
 * Protocol membership is still enforced by `boing_qaPoolVote` (administrators /
 * `dev_open_voting`). This layer is who may use the explorer vote proxy.
 */

const ACCOUNT_HEX = /^[0-9a-f]{64}$/;

export function parseReviewerAllowlist(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const hex = part.trim().replace(/^0x/i, "").toLowerCase();
    if (ACCOUNT_HEX.test(hex)) out.add(hex);
  }
  return out;
}

export function normalizeVoterHex(raw: string): string {
  return raw.trim().replace(/^0x/i, "").toLowerCase();
}

export function isAccountHex(hex: string): boolean {
  return ACCOUNT_HEX.test(hex);
}

/** Shared reviewer secret must be set and reasonably long. */
export function reviewerVotingConfigured(secret: string | undefined): boolean {
  return Boolean(secret && secret.trim().length >= 8);
}

export function reviewerTokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function voterOnAllowlist(voterHex: string, allowlist: Set<string>): boolean {
  if (allowlist.size === 0) return true;
  return allowlist.has(voterHex);
}
