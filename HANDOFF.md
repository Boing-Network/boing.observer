# Boing Observer - handoff

Short, current-state notes for the next maintainer or agent. Setup, env vars, scripts and deploy live in
[README.md](README.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md). Protocol truth lives in the
[boing.network](https://github.com/Boing-Network/boing.network) repo (`docs/`, `crates/boing-node/src/rpc.rs`,
`crates/boing-node/schemas/developer_api.json`).

Last reviewed against boing.network `main` and the public testnet: 2026-10-25.

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
| `/tools`, `/tools/rpc-catalog`, `/tools/node-health`, `/faucet`, `/about` | Operator and onboarding pages |
| `/api/*` | Server routes, see below |

Search accepts: block height, 64-hex block hash / tx id / account (resolved by RPC probing), and name labels.

## Data path

- Browser -> same-origin `POST /api/rpc` -> upstream node (never direct; avoids CORS).
- Proxy policy (`src/lib/rpc-proxy-policy.ts`, `src/app/api/rpc/route.ts`):
  allow-list of read methods plus oing_faucetRequest, name methods and oing_simulateContractCall (no transaction submit), `params` must be an array of <= 8,
  `id` coerced to a safe integer, batches rejected, 1 MiB request cap (bytes), 6 MiB response cap, 30 s upstream timeout,
  failover on 403 / 502-504 / 521-526 / 530 and Cloudflare challenge pages. Non-allowed methods get a JSON-RPC
  `-32601` error. No failover on `Method not found`.
- Server routes under `/api/*` call upstream directly with `createServerBoingClient` / `rpcCall`. They are **not**
  bound by the proxy allow-list, so each validates `network` (`testnet|mainnet`) and 32-byte hex ids itself.
- Client cache: `src/lib/rpc-cache.ts` (`cachedRpc`, bounded to 500 entries, TTL per call, failed entries evicted).
- Durable token index cache: `src/lib/token-index/*` (disk, default TTL 600 s, disabled with
  `TOKEN_INDEX_CACHE_DIR=off`; silently no-ops on read-only filesystems such as Workers).
- Security headers (`security-headers.mjs`, wired in `next.config.mjs`): nosniff, `X-Frame-Options: DENY`, HSTS,
  Referrer-Policy, Permissions-Policy and a **baseline** CSP (`base-uri`, `object-src`, `form-action`,
  `frame-ancestors`). `/pdfs/*` is relaxed to SAMEORIGIN framing. `public/_headers` covers static assets.
- `src/middleware.ts` (edge): (1) **rate limiting** for `/api/*` (`src/lib/rate-limit.ts`; Workers Rate Limiting binding
  `API_RATE_LIMITER` if configured, else per-isolate in-memory best effort), (2) a **Report-Only** full CSP
  (`src/lib/csp.ts`) with violation reports sent to `/api/csp-report`. See docs/OPERATIONS.md.

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
| Tx payloads | Decoded through the SDK payload catalog. Unknown payload types render as raw. |
| Linked NFT/token registry | **v2** `0xf704485a...55dd` (salt `BOING_NFT_TOKEN_LINK_REG_V2`, selectors `0xE0`-`0xE8`, `claim_self 0xE7`, `get_asset_deployer 0xE8`). v1 `0xebf9f019...3dd8` is superseded but still recognised. |
| Builder attestation registry | AccountId documented only; read-only "Builder attested" UI is **not shipped**. |

## Wallet (boing.express) contract

The explorer does not connect a wallet by itself except for QA voting (`/qa`), which uses the injected provider
(`boing_requestAccounts`, `boing_signMessage`, `boing_sendTransaction`; `boing_chainId`, `boing_switchChain`).
Unsigned fallback votes go through `BOING_QA_VOTE_RPC` using the server-only operator token.

## Indexing boundary (OBS-1)

Explorer pages aggregate from RPC with real limits (receipt caps, bounded block windows, timeouts). Durable,
chain-wide indexing is a separate concern. Today the only durable index is the optional **NFT owner indexer**
Worker (`boing.network/workers/nft-owner-indexer`) behind `NFT_OWNER_INDEXER_URL`;
`boing_getAccountTransactions` (cursor paged, newest first) is preferred for account history, with a block-scan
fallback.

## Known gaps / backlog (highest value first)

1. **Enforce a script-src CSP** (medium): a Report-Only policy ships today (`BOING_OBSERVER_CSP`, default `report-only`). A
   nonce policy (`nonce-report-only` / `nonce-enforce`) only works on dynamically rendered routes; the static pages
   (`/`, `/about`, `/dex/*`, `/faucet`, `/qa*`, `/tokens`, `/tools/*`) are prerendered at build time and cannot receive a
   per-request nonce. Path to enforcement: review `/api/csp-report` logs, then make the root layout dynamic
   (`export const dynamic = "force-dynamic"`, read `headers().get("x-nonce")` for the JSON-LD script) and switch to
   `nonce-report-only`, then `nonce-enforce`. Decision for Nico: accept SSR-on-every-request for strict CSP.
2. **Distributed rate limiting** (low-medium): the in-memory limiter is per isolate. Add the Workers Rate Limiting binding
   (`API_RATE_LIMITER`, sample in `wrangler.toml`) and/or Cloudflare WAF rate rules for a global limit.
3. `@opennextjs/cloudflare` currently pulls `@node-minify/core` -> `glob@10.x` (build-time only); pinned to 10.5.0 via
   `overrides`. Remove the override when upstream bumps it.
4. Builder attestation UI, interface registry (see `docs/CONTRACT-FUNCTIONS.md`).
5. Windows dev boxes that cannot reach `testnet-rpc.boing.network` (TLS) need a VPN/other network for live specs.

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
  expose a machine-readable chain-metadata source (chain id, native currency, explorer URL) so the explorer and wallet
  stop duplicating constants; keep `boing_getNetworkFeePolicy` and `native_currency` documented as the client source of truth;
  rate-limit/WAF guidance for public RPC.
- **boing.express:** deep-link to `boing.observer/tx/:id` and `/account/:addr` after send; share chain metadata and
  fee-policy parsing with the explorer; tip UX parity with `optional_priority_tips`.
- **boing.finance:** keep `description_hash` metadata gateway templates in sync with `TOKEN_METADATA_GATEWAY_URLS`.