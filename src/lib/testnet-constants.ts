/**
 * Deterministic testnet faucet account (see boing-node `faucet::testnet_faucet_account_id`).
 * Used to label faucet transfers in the explorer.
 */
export const TESTNET_FAUCET_ACCOUNT_HEX =
  "1e1a11f9eb8612aee66bdf0286dbb29ca662cadf7d76e384ac19449d62433615";

/**
 * Historical public testnet native CP pool `AccountId` (previous tunnel ledger, chain 6913).
 * Hosted Fly RPC currently leaves `end_user.canonical_native_cp_pool` unset — prefer live RPC.
 * See THREE-CODEBASE-ALIGNMENT.md §3.1.
 */
export const CANONICAL_TESTNET_NATIVE_CP_POOL_HEX =
  "7247ddc3180fdc4d3fd1e716229bfa16bad334a07d28aa9fda9ad1bfa7bdacc3";
