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
  "5b60d6f8514d1a8a40340fa354951d778b0821cd3ff7e534d0bea50f67d38976";

/**
 * Public testnet linked NFT↔fungible token registry **v2** (CREATE2 salt `BOING_NFT_TOKEN_LINK_REG_V2`, block 1174).
 * Selectors `0xE0`–`0xE8`; query via `links_count` / `get_link_at` (`0xE3` / `0xE4`). v2 carries over every v1 claim
 * and link; new assets claim themselves at deploy (`claim_self` `0xE7`), and `claim_asset` only works for an asset's
 * recorded deployer (`get_asset_deployer` `0xE8`), so claims cannot be front-run.
 * See BOING-LINKED-NFT-TOKEN.md. Override with `NEXT_PUBLIC_BOING_LINKED_NFT_TOKEN_REGISTRY`.
 */
export const CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_HEX =
  "0xf704485ad29f56bb6516ac822fcf9ca8fcb6c4266e22c9ed7f9c6908668655dd";

/** Superseded v1 registry (salt `BOING_NFT_TOKEN_LINK_REG_V1`; first `claim_asset` caller won). Still readable. */
export const CANONICAL_BOING_TESTNET_LINKED_NFT_TOKEN_REGISTRY_V1_HEX =
  "0xebf9f0190f415852f90d0e60343126201248ab96273fdbf8acc5fe5fa03c3dd8";
