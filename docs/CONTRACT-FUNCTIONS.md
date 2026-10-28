# Contract functions on contract pages

Boing VM contracts have no on-chain ABI. Every canonical template dispatches on a one-byte selector held in the
low byte of calldata word 0, followed by 32-byte argument words.

**Fungible token profiles (`/asset/…`):** reference tokens are still on-chain accounts with template bytecode (not
an EVM Solidity contract, and not a bare wallet). The selector list is developer chrome, so the explorer hides it
under **Technical details** on fungible asset pages. ABI helpers and `/api/contract/interface` remain available for
account pages, pools, and advanced expand.

How the explorer builds the "Contract functions" section (`/api/contract/interface`):

1. **Bytecode.** `boing_getContractCode` (bytecode + BLAKE3 code hash) is used first. On older nodes without it, the
   fallback is: `boing_getAccountTransactions(contract)` lists calls to the contract,
   so the earliest callers (plus the canonical testnet deployer) are treated as candidate deployers; their
   `contract_deploy` transactions are fetched and each deploy address is recomputed (CREATE2 or nonce-derived) until one
   matches. Contracts never called by their deployer may not be located.
2. **Selectors.** `src/lib/bytecode-selectors.ts` disassembles the bytecode and collects
   `<selector slot> MLOAD PUSH sel EQ [ISZERO] PUSH dest JUMPI` comparisons (slot = memory 0 or the slot that stored
   `calldata[0] & 0xff`). Other small-constant checks (hop counts, return words) are ignored.
3. **Interface.** In order: canonical testnet address table, exact bytecode match with a boing-sdk template
   (token v1/v2, NFT, pool v1..v9, custody router, registries), then best selector-set match. Named functions come from
   `src/lib/contract-interfaces.ts` (transcribed from `crates/boing-execution` and the protocol docs). Decoded
   selectors that no interface names are listed as unknown.
4. **Read calls.** Read functions can be queried with `boing_simulateContractCall` (dry run, no transaction).

## Readable transaction summaries (`/api/tx/context`)

`src/lib/tx-decode.ts` turns a contract call plus its receipt into a sentence ("Swapped 2,398 BOING for 2,464 USDC").
`/api/tx/context` supplies what the decoder cannot know:

- **Token names, symbols and decimals.** For every token the transaction touches (called contract, pool and vault pairs,
  other ids) the route calls `boing_getTokenMetadata`, so tokens that are in no DEX pool are named too. Name and symbol
  exist only when the deployer declared them in the deploy transaction; otherwise they stay empty and the UI shows a short
  address. The DEX directory (`boing_listDexTokens`) is the fallback and fills any gap. Nodes (and the public gateway)
  without the method answer "method not found" / 403; the route notes that for 10 minutes and uses the DEX directory only.
  Code: `src/lib/tx-context-rpc.ts`.
- **Decimals are on-chain facts.** Reference tokens (v1/v2/secured) store no decimals, so amounts are whole units
  (decimals 0). The wrapped BOING token reports 18. Nothing is guessed.
- **LP vault v2** (`lp-vault-v2`, selectors 0xC0..0xC3): the route reads the vault's pool and token pair from its storage
  (0xe2 pool, 0xe3 token A, 0xe4 token B). Deposit is described from the vault's DEPOSIT log (amounts the pool took, shares
  minted); withdraw from the pool's remove-liquidity log, because the vault's WITHDRAW log only repeats the caller's
  minimums. Fixtures are real testnet blocks 105 (deposit) and 106 (withdraw): `src/lib/__fixtures__/testnet-vault-blocks-105-106.json`.

## Proposal: publishing an interface on chain (not built)

A dependency-free way for deployers to publish an interface without consensus changes:

- **Interface registry contract** (same pattern as the linked NFT / builder attestation registries): `claim_asset`
  (first caller, normally the deployer right after deploy), `set_interface(asset, interface_hash, uri_hash)` by the
  claimer, `get_interface(asset)` read. `interface_hash` = BLAKE3 of a canonical JSON interface
  (`{ functions: [{ selector, name, params: [{ name, type }], kind, description, access }] }`, the shape the explorer
  already renders). The JSON itself is hosted anywhere (or embedded in deploy metadata) and accepted only when its hash
  matches.
- Alternatively extend the existing builder attestation registry `note_hash` to carry the interface hash.
- Explorer side: fetch the record, verify the hash, and prefer it over the selector heuristics.

`boing_getContractCode` now exists on the node, so step 1 is exact for every deployed contract; the deploy-search fallback only matters for older nodes.