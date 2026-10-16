# Contract functions on contract pages

Boing VM contracts have no on-chain ABI. Every canonical template dispatches on a one-byte selector held in the
low byte of calldata word 0, followed by 32-byte argument words.

How the explorer builds the "Contract functions" section (`/api/contract/interface`):

1. **Bytecode.** The node has no `getCode` RPC. `boing_getAccountTransactions(contract)` lists calls to the contract,
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

A `boing_getContractCode` RPC (read-only, no consensus change) would also make step 1 exact for every contract.