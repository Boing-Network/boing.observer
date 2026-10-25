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

## Network sync status (verified against boing.network `rpc.rs` and the live testnet)

| Area | Status |
|------|--------|
| Native denomination | 18 decimals. Testnet used whole BOING before block 1050 (`native_currency.base_units_from_height`), base units after; mainnet/new chains base units from 0. UI formats via `formatBoingAt`. |
| Fees | `boing_getNetworkFeePolicy` is typed (`BoingNetworkFeePolicy`) and fetched by `tryFetchNetworkFeePolicy` (60 s cache). The tx-page fee estimate still **hard-codes** 100 bps and the 1050 height (matches the live node today, see gaps). |
| Priority tips | Block `priority_tips` aligned with `transactions` (omitted when empty); u128 as number or decimal string. Decoded in `src/lib/priority-tips.ts`, shown on block and tx pages. |
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

1. **Fee estimate not live-driven** (low-medium): wire `tryFetchNetworkFeePolicy` + `native_currency` into the fee
   panel instead of the hard-coded 100 bps / 1050.
2. **No script-src CSP** (medium): needs nonces because Next inlines bootstrap/JSON-LD and NFT media comes from
   arbitrary https hosts. Add via middleware when ready.
3. **No app-level rate limiting** on `/api/*` (medium): use Cloudflare WAF/rate-limit rules on `/api/rpc` and the heavy
   routes (`account/history`, `asset/profile`, `tokens/index`).
4. `rpcCall` drops the JSON-RPC error `code` (throws message only) (low).
5. `/asset/[address]` First Load JS is ~251 kB vs ~105-145 kB elsewhere (medium-low): split the NFT/linked-token panels.
6. `token-metadata-lookup` reads the gateway body before checking size (low; gateways are fixed + operator-configured).
7. Builder attestation UI, interface registry (see `docs/CONTRACT-FUNCTIONS.md`).
8. Windows dev boxes that cannot reach `testnet-rpc.boing.network` (TLS) need a VPN/other network for live specs.

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