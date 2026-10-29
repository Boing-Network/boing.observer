# Boing Observer - handoff

Short, current-state notes for the next maintainer or agent. Setup, env vars, scripts and deploy live in
[README.md](README.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md). Protocol truth lives in the
[boing.network](https://github.com/Boing-Network/boing.network) repo (`docs/`, `crates/boing-node/src/rpc.rs`,
`crates/boing-node/schemas/developer_api.json`).

Last reviewed against boing.network `main` and the public testnet: 2026-10-29.

## What this is

Boing-native explorer for **boing.network** (own L1, own VM). It talks only to Boing JSON-RPC (plus
`@boing-network/boing-sdk` from npm). It embeds **no EVM / Solana / third-party chain runtime**. EVM tooling lives
in boing.finance. Stack: Next.js 15 App Router, React 18, Tailwind, deployed to Cloudflare Workers with OpenNext.

## Routes

| Route | Notes |
|-------|-------|
| `/` | Height, latest blocks (slow auto-refresh), unified search |
| `/block/:height`, `/block/hash/:hash` | Header, receipts/blobs roots, signature count, per-tx priority tips, tx list |
| `/tx/:txId` | Receipt, payload decode, fee estimate, priority tip, blob/media access |
| `/account/:address` | Balance (18-dec base units), nonce, stake, pending unbond, history window, NFT gallery |
| `/asset/:address`, `/asset/:address/item/:tokenId`, `/tokens` | Token/NFT profiles, linked companions, metadata |
| `/name/:label` | Name registry lookup |
| `/dex/pools`, `/dex/tokens`, `/dex/quote` | Read-only DEX directory and constant-product quotes (SDK) |
| `/qa`, `/qa/rules`, `/tools/qa-check` | QA pool, voting, rule list/PDF, `boing_qaCheck` |
| `/tools`, `/tools/rpc-catalog`, `/tools/node-health`, `/tools/account-proof`, `/faucet`, `/about` | Operator and onboarding pages. Node health flags a chain-id mismatch and shows `client_hints`; the catalog shows `protocol_specs`; account proof verifies `boing_getAccountProof` against recent block state roots |
| `/api/*` | Server routes, see below |

Search accepts: block height, 64-hex block hash / tx id / account (resolved by RPC probing), and name labels.

## Data path

- Browser -> same-origin `POST /api/rpc` -> upstream node (never direct; avoids CORS).
- Proxy policy (`src/lib/rpc-proxy-policy.ts`, `src/app/api/rpc/route.ts`):
  allow-list of read methods plus `boing_faucetRequest`, name methods and `boing_simulateContractCall` (no transaction submit), `params` must be an array of <= 8,
  `id` coerced to a safe integer, batches rejected, 1 MiB request cap (bytes), **6 MiB response cap** (same as public
  `testnet-rpc` gateway), incomplete / non-JSON upstream bodies rejected, 30 s upstream timeout,
  failover on 403 / 502-504 / 521-526 / 530 and Cloudflare challenge pages. Non-allowed methods get a JSON-RPC
  `-32601` error. No failover on `Method not found`. Hosted fallback is **`boing-testnet-1` only** (`boing-testnet-2` retired).
- **Slim block fetches:** UI calls `getBlockByHeight` / `ByHash` with `include_code=false` so PutBlob/deploy payloads stay
  stubs under the gateway cap; block pages may restore small ContractCall calldata afterward.
- **Blob download:** `GET /api/blob/download` (Fly-direct, not the gateway) — Phase 34 wallet proof for publisher/grantee;
  operator / `BOING_BLOB_DOWNLOAD_TOKENS` override. `GET /api/blob/access` → `boing_getBlobAccess`.
- Server routes under `/api/*` call upstream directly with `createServerBoingClient` / `rpcCall`. They are **not**
  bound by the proxy allow-list, so each validates `network` (`testnet|mainnet`) and 32-byte hex ids itself.
- Client cache: `src/lib/rpc-cache.ts` (`cachedRpc`, bounded to 500 entries, TTL per call, failed entries evicted).
- Durable token index cache: `src/lib/token-index/*` (disk, default TTL 600 s, disabled with
  `TOKEN_INDEX_CACHE_DIR=off`; silently no-ops on read-only filesystems such as Workers).
- Security headers (`security-headers.mjs`, wired in `next.config.mjs`): nosniff, `X-Frame-Options: DENY`, HSTS,
  Referrer-Policy, Permissions-Policy and a **baseline** CSP (`base-uri`, `object-src`, `form-action`,
  `frame-ancestors`). `/pdfs/*` is relaxed to SAMEORIGIN framing. `public/_headers` covers static assets.
- `src/middleware.ts` (edge): (1) **rate limiting** for `/api/*` (`src/lib/rate-limit.ts`; the Workers Rate Limiting bindings `API_RATE_LIMITER`,
  `API_RATE_LIMITER_HEAVY`, `API_RATE_LIMITER_VOTE` declared in `wrangler.toml`, plus the per-isolate in-memory limiter as fallback), (2) an
  **enforcing** nonce-based CSP (`src/lib/csp.ts`, `BOING_OBSERVER_CSP`, default `nonce-enforce`, rollback `report-only`) with violation
  reports sent to `/api/csp-report`. The root layout is `force-dynamic` so every page can carry the nonce (SSR on every request). See docs/OPERATIONS.md.

## Network sync status (verified against boing.network `rpc.rs` and the live testnet)

| Area | Status |
|------|--------|
| Native denomination | 18 decimals. Testnet used whole BOING before block 1050 (`native_currency.base_units_from_height`), base units after; mainnet/new chains base units from 0. UI formats via `formatBoingAt`. |
| Fees | `boing_getNetworkFeePolicy` is typed (`BoingNetworkFeePolicy`) and fetched by `tryFetchNetworkFeePolicy` (60 s cache). Fee estimates are now **live-driven**: `src/lib/native-unit-config.ts` derives gas price / `execution_gas_fee_bps` / `extra_fixed_fee` / base-unit activation height from `boing_getNetworkFeePolicy` + `boing_getNetworkInfo.native_currency` (loaded by `useNativeUnitConfig`), falling back to the historical constants (100 bps, 1050, 1e12) when a node does not report them; the UI labels which source was used. |
| Priority tips | Block `priority_tips` aligned with `transactions` (omitted when empty); u128 as number or decimal string. Decoded in `src/lib/priority-tips.ts`; `src/lib/block-normalize.ts` tolerates an absent / short / over-long `priority_tips` and falls back to a per-tx `priority_tip`. Shown on block and tx pages. |
| Submit rejections | `rpcCall` throws `BoingRpcCallError` (`src/lib/rpc-error.ts`) keeping JSON-RPC `code`, `data`, HTTP status and `Retry-After`. `describeRpcRejection` turns `unknown_sender`, `stale_nonce`, `insufficient_fee`, `already_in_mempool`, `free_pending_limit`, `free_tx_balance_gate`, `native_value_not_active` and the QA codes (-32050..-32057) into user-facing text (used by `getFriendlyRpcErrorMessage`, `mapWalletErrorToUi` and the QA vote gate). |
| Block fields | `receipts_root`, `blobs_root`, `signatures` typed and displayed. |
| Accounts | `pending_unbond`, `pending_unbond_boing`, `unbond_unlock_height` typed and shown. |
| Contract bytecode | `boing_getContractCode` first, deploy-search fallback for older nodes. |
| Chain IDs | testnet `0x1b01` (6913), mainnet `0x1b02` (6914): wallet convention, not in block headers. |
| Tx payloads | Decoded through the SDK payload catalog (incl. names, PutBlob, Grant/RevokeBlobDownload). Unknown payload types render as raw. Multi-tx block views group consecutive same-kind + same-signer txs. |
| Slim blocks / gateway | Explorer uses `include_code=false`; public gateway + `/api/rpc` refuse >6 MiB / truncated JSON. |
| Blob download ACL | Phase 34 wallet proof + operator override on PutBlob panels; see docs/OPERATIONS.md. |
| Testnet backends | `HOSTED_TESTNET_RPC_FALLBACKS` = `boing-testnet-1` only; t2 destroyed. |
| Linked NFT/token registry | **v2** `0xf704485a...55dd` (salt `BOING_NFT_TOKEN_LINK_REG_V2`, selectors `0xE0`-`0xE8`, `claim_self 0xE7`, `get_asset_deployer 0xE8`). v1 `0xebf9f019...3dd8` is superseded but still recognised. |
| Builder attestation registry | AccountId documented only; read-only "Builder attested" UI is **not shipped**. |

## Network selection, chain metadata and deep links

- `src/lib/network-param.ts` resolves the network as URL `?network=` > stored (`boing-explorer-network`) > testnet. A requested but
  unconfigured mainnet falls back to testnet with a visible notice (`network-link-notice`). `useNetwork()` exposes `ready`; every
  detail-page data effect waits for it so a deep link never fetches from the wrong chain.
- `src/data/chain-metadata.json` is a vendored copy of boing.network `docs/chain-metadata.json` (schema_version 1). `src/lib/chain-metadata.ts`
  feeds `chain-ids.ts`; `npm run sync:chain-metadata` refreshes it, and a drift test compares it with a sibling checkout when one exists.
- `client_hints` (`boing_health`) and `protocol_specs` (`boing_getRpcMethodCatalog`) are typed and displayed, advisory only.

## Account proofs, storage-tree v2, receipt retention

- `/tools/account-proof`: `boing_getAccountProof` + `boing_verifyAccountProof` (allow-listed). The node verifies its own proof, so the UI
  also checks the proof root against the newest 3 block `state_root`s and states that trust limit. `boing_getAccount` has no storage root.
- Storage-tree v2 (`BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT` on the node, consensus-wide, OFF by default). Newer nodes publish
  `storage_tree_v2_activation_height` (integer, or `null` = not configured) in `boing_getNetworkInfo`; `src/lib/storage-tree.ts` prefers it,
  then the optional `NEXT_PUBLIC_BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT`, else reports "unknown" and makes no claim (older nodes omit the key).
  Proof verification is layout-agnostic.
- `boing_getTransactionReceipt` is `null` for unknown **and** pruned receipts (default window 1,000,000 blocks). `/tx/:id` keeps "No receipt
  for this id" and adds a head-aware explanation (`src/lib/receipt-retention.ts`), using `receipt_retention_blocks` from node info when
  present (integer, or `null` = unbounded), else the build env mirror, else the default. Indexing note in docs/OPERATIONS.md.
- The node-info fields above are documented in boing.network `docs/RPC-API-SPEC.md`; until a node release returns them the explorer behaves exactly as before.

## Wallet (boing.express) contract

The explorer connects a wallet for:

- **QA voting** (`/qa`): `boing_requestAccounts`, `boing_signMessage`, `boing_sendTransaction`; `boing_chainId`, `boing_switchChain`.
  Unsigned fallback votes go through `BOING_QA_VOTE_RPC` using the server-only operator token.
- **PutBlob download** (Phase 34): same injected provider; signs a domain-separated download proof (not a chain tx).
  Operator shared-token paste remains a break-glass override on the panel.

## Indexing boundary (OBS-1)

Explorer pages aggregate from RPC with real limits (receipt caps, bounded block windows, timeouts). Durable,
chain-wide indexing is a separate concern. Today the only durable index is the optional **NFT owner indexer**
Worker (`boing.network/workers/nft-owner-indexer`) behind `NFT_OWNER_INDEXER_URL`;
`boing_getAccountTransactions` (cursor paged, newest first) is preferred for account history, with a block-scan
fallback.

## Known gaps / backlog (highest value first)

1. **Roll out and watch the enforced CSP and rate limits** (code done in `optimize/observer-4`, not yet deployed from this repo by hand):
   check the `7101`-`7103` namespace ids are free in the Cloudflare account, deploy per the checklist in docs/OPERATIONS.md (a push to `main`
   deploys via CI), watch `/api/csp-report`, keep `BOING_OBSERVER_CSP=report-only` as the rollback. If SSR-on-every-request cost matters, move
   the nonce to a small dynamic shell and prerender the rest (not possible with plain `force-dynamic`).
2. `@opennextjs/cloudflare` currently pulls `@node-minify/core` -> `glob@10.x` (build-time only); pinned to 10.5.0 via
   `overrides`. Remove the override when upstream bumps it.
3. Builder attestation UI, interface registry (see `docs/CONTRACT-FUNCTIONS.md`).
4. Windows dev boxes that cannot reach `testnet-rpc.boing.network` (TLS) need a VPN/other network for live specs.

Resolved in `optimize/observer-4`: enforced nonce CSP (`nonce-enforce` default, `force-dynamic` root layout, `e2e/csp.spec.ts`), Workers Rate Limiting
bindings in `wrangler.toml` (three buckets) with the in-memory limiter as fallback, `storage_tree_v2_activation_height` and `receipt_retention_blocks` read
from `boing_getNetworkInfo` (tolerating absence), deploy checklist and WAF rule equivalents in docs/OPERATIONS.md.

Resolved in `optimize/observer-3`: `?network=` deep links, vendored chain metadata + drift test, `client_hints` / `protocol_specs` / chain-id mismatch UI,
account proof tool, storage-tree v2 handling (tolerant), null-receipt retention message, Dependabot (API reports 0 open, 100 fixed).

Resolved in `optimize/observer-2`: live fee policy, JSON-RPC error codes/data, tolerant tip decoding, `/api/*` rate
limiting, Report-Only CSP, streaming size cap for gateway/blob bodies, `/asset` + `/account` First Load JS 253 kB -> 140 kB
(recharts, contract tools and NFT gallery are code-split), `npm audit` = 0 vulnerabilities (vite 7.3.7, glob 10.5.0).

## Verification checklist

```bash
npm ci --legacy-peer-deps
npm run lint && npm run typecheck && npm test
npm run build && npm run test:e2e        # live testnet specs are opt-in, see docs/OPERATIONS.md
```

## Cross-repo follow-ups

- **boing.network:** publish a stable spec for `priority_tips` and block `signatures` in `developer_api.json`/docs;
  release a node that returns `storage_tree_v2_activation_height` and `receipt_retention_blocks` in `boing_getNetworkInfo` (the explorer already reads them and
  tolerates absence; chain-metadata.json is vendored here; re-run `npm run sync:chain-metadata` once boing.network publishes its pending metadata change); keep `boing_getNetworkFeePolicy` and `native_currency` documented as the client source of truth;
  rate-limit/WAF guidance for public RPC.
- **boing.express:** deep-link to `boing.observer/tx/:id` and `/account/:addr` after send; share chain metadata and
  fee-policy parsing with the explorer; tip UX parity with `optional_priority_tips`.
- **boing.finance:** keep `description_hash` metadata gateway templates in sync with `TOKEN_METADATA_GATEWAY_URLS`.