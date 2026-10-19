/**
 * Known Boing VM contract interfaces.
 *
 * Boing contracts have no on-chain ABI. Every canonical template dispatches on a one-byte selector in
 * the low byte of calldata word 0, followed by 32-byte argument words (see boing.network
 * `boing-sdk/src/calldata.ts`). The tables below are transcribed from the template sources in
 * `crates/boing-execution/src/*.rs` and the protocol docs (`docs/BOING-REFERENCE-TOKEN.md`, ...).
 */

export type AbiParamType = "account" | "u128" | "u64" | "bytes32" | "bool" | "u8";

export type AbiParam = { name: string; type: AbiParamType; note?: string };

export type ContractFunction = {
  /** Selector byte (low byte of calldata word 0). */
  selector: number;
  name: string;
  params: AbiParam[];
  /** `read` = returns data without changing state (safe to simulate). */
  kind: "read" | "write";
  description: string;
  /** Who may call it and when. */
  access: string;
  returns?: string;
  /** Free-form calldata layout when the words are not a fixed list (routers). */
  layout?: string;
};

export type ContractInterface = {
  id: string;
  name: string;
  summary: string;
  docsUrl?: string;
  functions: ContractFunction[];
};

const DOCS = "https://github.com/Boing-Network/boing.network/blob/main/docs";
const acct = (name: string, note?: string): AbiParam => ({ name, type: "account", ...(note ? { note } : {}) });
const u128 = (name: string, note?: string): AbiParam => ({ name, type: "u128", ...(note ? { note } : {}) });
const u64 = (name: string, note?: string): AbiParam => ({ name, type: "u64", ...(note ? { note } : {}) });
const deadline = u64("deadline", "block height; 0 = none");

const FUNGIBLE_V1: ContractFunction[] = [
  {
    selector: 0x01,
    name: "transfer",
    params: [acct("to"), u128("amount")],
    kind: "write",
    description: "Move `amount` from the caller's balance to `to`.",
    access: "Anyone (spends the caller's own balance).",
  },
  {
    selector: 0x02,
    name: "mint_first",
    params: [acct("to"), u128("amount")],
    kind: "write",
    description: "One-time initial mint of the supply to `to`.",
    access: "Admin only, once. The admin is the first account to call the contract.",
  },
];

const FUNGIBLE_V2_EXTRA: ContractFunction[] = [
  {
    selector: 0x08,
    name: "approve",
    params: [acct("spender"), u128("amount")],
    kind: "write",
    description: "Set (overwrite) how much `spender` may move from the caller with transfer_from.",
    access: "Anyone (sets the caller's own allowance).",
    returns: "word 1",
  },
  {
    selector: 0x09,
    name: "transfer_from",
    params: [acct("from"), acct("to"), u128("amount")],
    kind: "write",
    description: "Move `amount` from `from` to `to` using the caller's allowance; decrements the allowance.",
    access: "Any spender with allowance[from][caller] >= amount. Fails with no return data otherwise.",
    returns: "word 1 on success",
  },
  {
    selector: 0x0a,
    name: "allowance",
    params: [acct("owner"), acct("spender")],
    kind: "read",
    description: "How much `spender` may still move from `owner`.",
    access: "Anyone.",
    returns: "u128 allowance",
  },
];

const POOL_ADMIN: ContractFunction[] = [
  {
    selector: 0x13,
    name: "set_tokens",
    params: [acct("token_a"), acct("token_b")],
    kind: "write",
    description: "Bind the pool to its two token contracts.",
    access: "Once per pool, before any liquidity (later calls are rejected).",
  },
  {
    selector: 0x14,
    name: "set_swap_fee_bps",
    params: [u128("fee_bps", "1..10000")],
    kind: "write",
    description: "Change the swap fee in basis points (default 30).",
    access: "Fee admin (or anyone while total LP supply is 0, depending on version).",
  },
  {
    selector: 0x17,
    name: "set_fee_admin",
    params: [acct("admin")],
    kind: "write",
    description: "Set the account allowed to change the swap fee.",
    access: "Only while total LP supply is 0.",
  },
];

const POOL_CUSTODY: ContractFunction[] = [
  {
    selector: 0x10,
    name: "swap",
    params: [u128("direction", "0 = A to B, 1 = B to A"), u128("amount_in"), u128("min_out"), deadline],
    kind: "write",
    description: "Swap tokens. The pool pulls `amount_in` from the caller with transfer_from and pays the output to the caller.",
    access: "Anyone who approved the pool for `amount_in`. Faults if output < min_out or past the deadline.",
    returns: "amount_out (v9)",
  },
  {
    selector: 0x15,
    name: "swap_to",
    params: [u128("direction"), u128("amount_in"), u128("min_out"), acct("recipient"), deadline],
    kind: "write",
    description: "Swap and pay the output to `recipient` (used by routers).",
    access: "Anyone who approved the pool for `amount_in`.",
    returns: "amount_out (v9)",
  },
  {
    selector: 0x11,
    name: "add_liquidity",
    params: [u128("amount_a"), u128("amount_b"), u128("min_liquidity"), deadline],
    kind: "write",
    description: "Deposit both tokens (pulled with transfer_from) and mint LP shares to the caller.",
    access: "Anyone who approved the pool for both amounts. Tokens must be set first.",
    returns: "LP minted",
  },
  {
    selector: 0x12,
    name: "remove_liquidity",
    params: [u128("liquidity"), u128("min_a"), u128("min_b"), deadline],
    kind: "write",
    description: "Burn the caller's LP shares and pay out both tokens to the caller.",
    access: "LP holders (burns the caller's own shares).",
  },
  {
    selector: 0x16,
    name: "remove_liquidity_to",
    params: [u128("liquidity"), u128("min_a"), u128("min_b"), acct("recipient_a"), acct("recipient_b"), deadline],
    kind: "write",
    description: "Burn the caller's LP shares and pay each token to its own recipient.",
    access: "LP holders (burns the caller's own shares).",
  },
  ...POOL_ADMIN,
];

const POOL_LEDGER: ContractFunction[] = [
  {
    selector: 0x10,
    name: "swap",
    params: [u128("direction"), u128("amount_in"), u128("min_out")],
    kind: "write",
    description: "Swap against the pool's ledger reserves (no token pull in v1..v7).",
    access: "Anyone.",
  },
  {
    selector: 0x15,
    name: "swap_to",
    params: [u128("direction"), u128("amount_in"), u128("min_out"), acct("recipient")],
    kind: "write",
    description: "Swap and credit `recipient` (v5+).",
    access: "Anyone.",
  },
  {
    selector: 0x11,
    name: "add_liquidity",
    params: [u128("amount_a"), u128("amount_b"), u128("min_liquidity")],
    kind: "write",
    description: "Add to the ledger reserves and mint LP shares to the caller.",
    access: "Anyone.",
  },
  {
    selector: 0x12,
    name: "remove_liquidity",
    params: [u128("liquidity"), u128("min_a"), u128("min_b")],
    kind: "write",
    description: "Burn the caller's LP shares for both reserves.",
    access: "LP holders.",
  },
  {
    selector: 0x16,
    name: "remove_liquidity_to",
    params: [u128("liquidity"), u128("min_a"), u128("min_b"), acct("recipient_a"), acct("recipient_b")],
    kind: "write",
    description: "Burn LP shares and credit each side to its own recipient (v5+).",
    access: "LP holders.",
  },
  ...POOL_ADMIN,
];

export const CONTRACT_INTERFACES: Record<string, ContractInterface> = {
  "fungible-v1": {
    id: "fungible-v1",
    name: "Reference fungible token (v1)",
    summary: "Boing reference token: balances, one-time mint, transfers.",
    docsUrl: `${DOCS}/BOING-REFERENCE-TOKEN.md`,
    functions: FUNGIBLE_V1,
  },
  "fungible-v2": {
    id: "fungible-v2",
    name: "Reference fungible token (v2)",
    summary: "Reference token v1 plus allowances (approve / transfer_from), required by custody pools, routers and vaults.",
    docsUrl: `${DOCS}/BOING-REFERENCE-TOKEN.md`,
    functions: [...FUNGIBLE_V1, ...FUNGIBLE_V2_EXTRA],
  },
  "fungible-secured": {
    id: "fungible-secured",
    name: "Secured reference fungible token",
    summary: "Reference token with deny-list, pause, caps, anti-bot window, cooldown and transfer-unlock height.",
    docsUrl: `${DOCS}/BOING-REFERENCE-TOKEN.md`,
    functions: [
      ...FUNGIBLE_V1,
      { selector: 0x03, name: "set_deny", params: [acct("account"), u128("denied", "1 = deny, 0 = allow")], kind: "write", description: "Add or remove an account from the deny-list.", access: "Admin only (until renounced)." },
      { selector: 0x04, name: "set_pause", params: [acct("unused"), u128("paused", "1 = pause, 0 = resume")], kind: "write", description: "Pause or resume all transfers.", access: "Admin only (until renounced)." },
      { selector: 0x05, name: "renounce_admin", params: [], kind: "write", description: "Give up admin rights permanently.", access: "Admin only." },
      { selector: 0x07, name: "set_transfer_unlock", params: [acct("unused"), u64("height")], kind: "write", description: "Set the block height before which transfers are locked.", access: "Admin only (until renounced)." },
    ],
  },
  nft: {
    id: "nft",
    name: "Reference NFT collection",
    summary: "Boing reference NFT collection: ownership, transfers, metadata hashes, batch mint.",
    docsUrl: `${DOCS}/BOING-REFERENCE-NFT.md`,
    functions: [
      { selector: 0x03, name: "owner_of", params: [u128("token_id")], kind: "read", description: "Current holder of `token_id`.", access: "Anyone.", returns: "owner account" },
      { selector: 0x04, name: "transfer_nft", params: [acct("to"), u128("token_id")], kind: "write", description: "Transfer `token_id` to `to` (the admin lazily mints unowned ids this way).", access: "Current owner, or the admin for unminted ids. The admin is the first caller." },
      { selector: 0x05, name: "set_metadata_hash", params: [u128("token_id"), { name: "metadata_hash", type: "bytes32" }], kind: "write", description: "Bind a metadata hash to `token_id`.", access: "Collection admin (lazy admin: the first caller)." },
      { selector: 0x06, name: "mint_batch", params: [], kind: "write", description: "Atomic multi-mint (template v2+), up to 500 tokens.", access: "Admin only.", layout: "sel | count | (to, token_id) x count (96 + 64n bytes)" },
    ],
  },
  "pool-custody": {
    id: "pool-custody",
    name: "Native constant-product pool (v8 / v9, custody)",
    summary: "Token-pulling AMM pool over two reference-v2 tokens. Rejections fault (whole tx reverts), reentrancy lock, optional deadlines. v9 also returns amount_out from swaps.",
    docsUrl: `${DOCS}/NATIVE-AMM-CALLDATA.md`,
    functions: POOL_CUSTODY,
  },
  "pool-ledger": {
    id: "pool-ledger",
    name: "Native constant-product pool (v1..v7, ledger)",
    summary: "Ledger-reserve AMM pool (no token pulls). Available selectors depend on the version.",
    docsUrl: `${DOCS}/NATIVE-AMM-CALLDATA.md`,
    functions: POOL_LEDGER,
  },
  "lp-vault-v2": {
    id: "lp-vault-v2",
    name: "LP vault v2 (custody pools)",
    summary: "Deposit both tokens, the vault adds liquidity to a v8/v9 pool and mints vault shares 1:1 with the LP; withdraw burns shares and the pool pays you directly.",
    functions: [
      { selector: 0xc0, name: "configure", params: [acct("pool"), acct("token_a"), acct("token_b")], kind: "write", description: "Bind the vault to its pool and token pair.", access: "Once (non-zero, distinct tokens)." },
      { selector: 0xc1, name: "deposit", params: [u128("amount_a"), u128("amount_b"), u128("min_shares"), deadline], kind: "write", description: "Pull both amounts from the caller, add liquidity to the pool, mint shares.", access: "Anyone who approved the vault for both amounts.", returns: "shares minted" },
      { selector: 0xc2, name: "withdraw", params: [u128("shares"), u128("min_a"), u128("min_b"), deadline], kind: "write", description: "Burn shares; the pool pays both tokens straight to the caller.", access: "Share holders (burns the caller's own shares)." },
      { selector: 0xc3, name: "transfer_shares", params: [acct("to"), u128("amount")], kind: "write", description: "Move vault shares to another account.", access: "Share holders." },
    ],
  },
  "lp-vault-v1": {
    id: "lp-vault-v1",
    name: "Native AMM LP vault (v1)",
    summary: "Drives ledger-only v1..v7 pools; configure-once, no withdraw.",
    docsUrl: `${DOCS}/NATIVE-AMM-LP-VAULT.md`,
    functions: [
      { selector: 0xc0, name: "configure", params: [acct("pool"), acct("share_token")], kind: "write", description: "Bind the vault to its pool and LP share token.", access: "Once." },
      { selector: 0xc1, name: "deposit_add", params: [u128("min_lp")], kind: "write", description: "Forward a 128-byte add_liquidity call to the pool, require returned LP >= min_lp, then mint that many share tokens to the caller.", access: "Anyone.", layout: "sel | inner add_liquidity calldata (128 bytes) | min_lp" },
    ],
  },
  "lp-share-token": {
    id: "lp-share-token",
    name: "Native LP share token",
    summary: "Fungible LP share token minted by an LP vault.",
    docsUrl: `${DOCS}/NATIVE-LP-SHARE-TOKEN.md`,
    functions: [
      { selector: 0x01, name: "transfer", params: [acct("to"), u128("amount")], kind: "write", description: "Move shares from the caller to `to`.", access: "Anyone (own balance)." },
      { selector: 0x06, name: "mint", params: [acct("to"), u128("amount")], kind: "write", description: "Mint shares to `to`.", access: "Minter only (the vault)." },
      { selector: 0x07, name: "set_minter_once", params: [acct("minter")], kind: "write", description: "Set the minter.", access: "Once." },
    ],
  },
  "custody-router": {
    id: "custody-router",
    name: "Custody router (v1)",
    summary: "Pulls the input token from the signer, then runs 1..4 sequential swap_to hops across v8/v9 pools. Every failure reverts all hops.",
    functions: [
      {
        selector: 0xf1,
        name: "swap",
        params: [u128("hops", "1..4"), u128("amount_in"), u128("min_out"), acct("recipient"), deadline],
        kind: "write",
        description: "Multi-hop swap; intermediate hops pay the router and must be v9 pools, the last hop pays `recipient`.",
        access: "Anyone who approved the router for amount_in on the first input token. Only ever pulls from the caller.",
        layout: "sel | hops | amount_in | min_out | recipient | deadline | (pool, direction, token_in) x hops",
        returns: "amount_out of the last hop (v9)",
      },
    ],
  },
  "ledger-router": {
    id: "ledger-router",
    name: "Native DEX ledger router",
    summary: "Forwards pool calldata with Caller = router. Only safe with ledger-only pools.",
    docsUrl: `${DOCS}/NATIVE-DEX-LEDGER-ROUTER.md`,
    functions: [
      { selector: 0xe0, name: "forward_pool_call", params: [acct("pool")], kind: "write", description: "Forward a 128-byte pool call (swap / add / remove).", access: "Anyone.", layout: "sel | pool | inner calldata (128 bytes)" },
      { selector: 0xe1, name: "forward_pool_call_v2", params: [acct("pool")], kind: "write", description: "Forward a 160-byte pool call (e.g. swap_to).", access: "Anyone.", layout: "sel | pool | inner calldata (160 bytes)" },
      { selector: 0xe2, name: "forward_pool_call_v3", params: [acct("pool")], kind: "write", description: "Forward a 192-byte pool call (remove_liquidity_to).", access: "Anyone.", layout: "sel | pool | inner calldata (192 bytes)" },
    ],
  },
  "multihop-router": {
    id: "multihop-router",
    name: "Native DEX multihop swap router",
    summary: "2..6 hop swaps over ledger pools in one transaction (Caller = router).",
    docsUrl: `${DOCS}/NATIVE-DEX-MULTIHOP-SWAP-ROUTER.md`,
    functions: [2, 3, 4, 5, 6].flatMap((n) => [
      { selector: 0xe5 + (n - 2) * 2, name: `swap${n}_128`, params: [], kind: "write" as const, description: `${n}-hop swap with 128-byte inner pool calls (swap).`, access: "Anyone.", layout: `sel | (pool, inner 128-byte calldata) x ${n}` },
      { selector: 0xe6 + (n - 2) * 2, name: `swap${n}_160`, params: [], kind: "write" as const, description: `${n}-hop swap with 160-byte inner pool calls (swap_to).`, access: "Anyone.", layout: `sel | (pool, inner 160-byte calldata) x ${n}` },
    ]),
  },
  "dex-factory": {
    id: "dex-factory",
    name: "Native DEX factory (pair directory)",
    summary: "On-chain directory of (token_a, token_b, pool) pairs.",
    docsUrl: `${DOCS}/NATIVE-DEX-FACTORY.md`,
    functions: [
      { selector: 0xd0, name: "register_pair", params: [acct("token_a"), acct("token_b"), acct("pool")], kind: "write", description: "Append a pair to the directory.", access: "Anyone." },
      { selector: 0xd1, name: "pairs_count", params: [], kind: "read", description: "Number of registered pairs.", access: "Anyone.", returns: "count" },
      { selector: 0xd2, name: "get_pair_at", params: [u64("index")], kind: "read", description: "Pair at `index`.", access: "Anyone.", returns: "token_a, token_b, pool" },
    ],
  },
  "linked-nft-registry": {
    id: "linked-nft-registry",
    name: "Linked NFT / token registry",
    summary: "Many-to-many links between NFT collections and project tokens, authorised by each asset's claimer.",
    docsUrl: `${DOCS}/BOING-LINKED-NFT-TOKEN.md`,
    functions: [
      { selector: 0xe0, name: "claim_asset", params: [acct("asset")], kind: "write", description: "Become the claimer of an asset you control.", access: "First caller for that asset becomes its claimer (claim right after deploy so nobody front-runs it)." },
      { selector: 0xe1, name: "register_link", params: [acct("collection"), acct("token")], kind: "write", description: "Link a collection to a token.", access: "Claimer of both assets." },
      { selector: 0xe2, name: "unlink_at", params: [u64("index")], kind: "write", description: "Tombstone the link at `index`.", access: "Claimer of either asset." },
      { selector: 0xe3, name: "links_count", params: [], kind: "read", description: "Number of link slots (including tombstones).", access: "Anyone.", returns: "count" },
      { selector: 0xe4, name: "get_link_at", params: [u64("index")], kind: "read", description: "Link at `index`.", access: "Anyone.", returns: "collection, token" },
      { selector: 0xe5, name: "get_asset_claimer", params: [acct("asset")], kind: "read", description: "Claimer of `asset`.", access: "Anyone.", returns: "claimer account" },
      { selector: 0xe6, name: "transfer_asset_claimer", params: [acct("asset"), acct("new_claimer")], kind: "write", description: "Hand the claim to another account.", access: "Current claimer." },
    ],
  },
  "linked-nft-registry-v2": {
    id: "linked-nft-registry-v2",
    name: "Linked NFT / token registry v2",
    summary:
      "Many-to-many links between NFT collections and project tokens, authorised by each asset's claimer. An asset's claimer is its creator: new assets claim themselves in their deploy transaction, older ones can be claimed only by their recorded deployer.",
    docsUrl: `${DOCS}/BOING-LINKED-NFT-TOKEN.md`,
    functions: [
      { selector: 0xe0, name: "claim_asset", params: [acct("asset")], kind: "write", description: "Claim an asset that existed before v2.", access: "Only the asset's recorded deployer (see get_asset_deployer); a no-op for the current claimer." },
      { selector: 0xe1, name: "register_link", params: [acct("collection"), acct("token")], kind: "write", description: "Link a collection to a token.", access: "Claimer of both assets." },
      { selector: 0xe2, name: "unlink_at", params: [u64("index")], kind: "write", description: "Tombstone the link at `index`.", access: "Claimer of either asset." },
      { selector: 0xe3, name: "links_count", params: [], kind: "read", description: "Number of link slots (including tombstones).", access: "Anyone.", returns: "count" },
      { selector: 0xe4, name: "get_link_at", params: [u64("index")], kind: "read", description: "Link at `index`.", access: "Anyone.", returns: "collection, token" },
      { selector: 0xe5, name: "get_asset_claimer", params: [acct("asset")], kind: "read", description: "Claimer of `asset`.", access: "Anyone.", returns: "claimer account" },
      { selector: 0xe6, name: "transfer_asset_claimer", params: [acct("asset"), acct("new_claimer")], kind: "write", description: "Hand the claim to another account.", access: "Current claimer." },
      { selector: 0xe7, name: "claim_self", params: [acct("claimer")], kind: "write", description: "Called by a new asset from its deploy init code: records `claimer` (its creator) as the claimer of the calling contract.", access: "The asset itself (caller = asset), once." },
      { selector: 0xe8, name: "get_asset_deployer", params: [acct("asset")], kind: "read", description: "Recorded deployer of a pre-v2 asset (the account allowed to claim_asset it).", access: "Anyone.", returns: "deployer account" },
    ],
  },
  "builder-attestation": {
    id: "builder-attestation",
    name: "Builder attestation registry",
    summary: "Builders attest (collection, token) pairs with an optional note hash.",
    docsUrl: `${DOCS}/BOING-BUILDER-ATTESTATION.md`,
    functions: [
      { selector: 0xe0, name: "claim_asset", params: [acct("asset")], kind: "write", description: "Become the claimer of an asset you control.", access: "First caller for that asset becomes its claimer (claim right after deploy so nobody front-runs it)." },
      { selector: 0xe1, name: "attest", params: [acct("collection"), acct("token"), { name: "note_hash", type: "bytes32" }], kind: "write", description: "Record an attestation for a pair.", access: "Claimer per registry rules." },
      { selector: 0xe2, name: "revoke_at", params: [u64("index")], kind: "write", description: "Tombstone the attestation at `index`.", access: "The attesting builder / claimer." },
      { selector: 0xe3, name: "attestations_count", params: [], kind: "read", description: "Number of attestation slots (including tombstones).", access: "Anyone.", returns: "count" },
      { selector: 0xe4, name: "get_attestation_at", params: [u64("index")], kind: "read", description: "Attestation at `index`.", access: "Anyone.", returns: "collection, token, builder, note_hash" },
      { selector: 0xe5, name: "get_asset_claimer", params: [acct("asset")], kind: "read", description: "Claimer of `asset`.", access: "Anyone.", returns: "claimer account" },
      { selector: 0xe6, name: "transfer_asset_claimer", params: [acct("asset"), acct("new_claimer")], kind: "write", description: "Hand the claim to another account.", access: "Current claimer." },
    ],
  },
};

/** Selector set of an interface (sorted). */
export function interfaceSelectors(id: string): number[] {
  return (CONTRACT_INTERFACES[id]?.functions ?? []).map((f) => f.selector).sort((a, b) => a - b);
}

/**
 * Best interface for a decoded selector set. Score = shared selectors minus half the mismatches; at least
 * 60% of the decoded selectors must be known to the interface. Ties go to the first interface in catalog
 * order. `exact` = identical selector sets.
 */
export function matchInterfaceBySelectors(selectors: number[]): { id: string; exact: boolean } | null {
  const have = new Set(selectors);
  if (have.size === 0) return null;
  let best: { id: string; exact: boolean; score: number } | null = null;
  for (const id of Object.keys(CONTRACT_INTERFACES)) {
    const want = new Set(interfaceSelectors(id));
    const shared = [...have].filter((s) => want.has(s)).length;
    if (shared === 0 || shared < Math.ceil(have.size * 0.6)) continue;
    const mismatches = have.size - shared + (want.size - shared);
    const score = shared - mismatches / 2;
    if (!best || score > best.score) best = { id, exact: mismatches === 0, score };
  }
  return best ? { id: best.id, exact: best.exact } : null;
}
export function formatSelector(s: number): string {
  return `0x${s.toString(16).padStart(2, "0")}`;
}