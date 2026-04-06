# Boing Observer Handoff

This document is intended for agents or contributors working in the `boing.network` website repo and the `boing.express` wallet repo. It describes where `boing.observer` currently stands, what it depends on, and which cross-project improvements would most benefit the broader Boing ecosystem.

It has been updated to reflect the current `boing.network` state, including the testnet portal sign-in flow, the nonce-backed wallet-auth rollout, and the need to keep explorer, website, and wallet behavior synchronized.

Cross-repo backlog and consumer alignment for **boing.express**, **boing.observer**, and partner dApps now also live in the network monorepo as [HANDOFF-DEPENDENT-PROJECTS.md](https://github.com/Boing-Network/boing.network/blob/main/docs/HANDOFF-DEPENDENT-PROJECTS.md), alongside [THREE-CODEBASE-ALIGNMENT.md](https://github.com/Boing-Network/boing.network/blob/main/docs/THREE-CODEBASE-ALIGNMENT.md). This file remains the observer-local view; treat the network doc as the shared checklist and verification entry point.

## Current Status

`boing.observer` is a functioning read-only blockchain explorer for Boing Network built with `Next.js 15`, `React 18`, `TypeScript`, `Tailwind CSS`, and deployed toward `Cloudflare Workers` via the `OpenNext` Cloudflare adapter.

Current state:

- Home page works as a live explorer landing page.
- Testnet is the default network; mainnet selection is only enabled when a distinct mainnet RPC is configured.
- Block lookup works by both height and hash.
- Account lookup works by 32-byte hex address (strict 64 hex digits; no silent padding of short input).
- Transaction detail exists at `/tx/[txId]` when the node returns receipts.
- Basic chain metrics and charts are implemented client-side.
- QA pre-flight tooling is exposed in the UI.
- Faucet UI is exposed for testnet.
- Native DEX read-only tooling: `/dex/pools` (directory snapshot + optional bounded logs) and `/dex/quote` (CP route quotes via `boing-sdk`), aligned with [HANDOFF-DEPENDENT-PROJECTS.md](https://github.com/Boing-Network/boing.network/blob/main/docs/HANDOFF-DEPENDENT-PROJECTS.md) Observer §3.
- SEO, structured data, sitemap, robots, favicon, OG image, and metadata are implemented.
- Build passes successfully with `npm run build`.

## What Exists Today

### User-facing routes

- `/`
  - Search by block height, block hash, or account address.
  - Shows chain tip, latest blocks, summary stats, and charts.
- `/block/[height]`
  - Block header details and transaction list.
- `/block/hash/[hash]`
  - Block lookup by hash with the same detail surface.
- `/account/[address]`
  - Account balance, nonce, and stake; optional **contract hints** (`boing_getNetworkInfo` canonical addresses + `boing_getContractStorage` zero-slot probe).
- `/tx/[txId]`
  - Transaction receipt and decoded payload when available from RPC.
- `/dex/pools`, `/dex/quote`
  - Server-backed `boing-sdk` views (directory + quotes); respect header network selector.
- `/tools/qa-check`
  - Calls the protocol QA RPC to evaluate deployment bytecode before submission.
- `/tools/rpc-catalog`
  - Live `boing_getRpcMethodCatalog` table for the selected RPC (method-not-found hints link to alignment §2.1).
- `/tools/node-health`
  - `boing_chainHeight`, `boing_getSyncState`, optional `boing_health` (RPC limits + metrics when exposed).
- `/faucet`
  - Testnet faucet request flow.
- `/about`
  - Network positioning, six pillars, and links to canonical docs.

### RPC methods currently used by the explorer

- `boing_chainHeight`
- `boing_getBlockByHeight`
- `boing_getBlockByHash`
- `boing_getAccount`
- `boing_getNetworkInfo` (block pages consensus hint; account contract hints)
- `boing_getContractStorage` (optional account zero-slot probe)
- `boing_getRpcMethodCatalog` (`/tools/rpc-catalog`)
- `boing_health` (optional; `/tools/node-health`)
- `boing_getSyncState` (sync panel, network stats, node health)
- `boing_qaCheck`
- `boing_faucetRequest`

### Core behavior

- Most views use plain JSON-RPC over `fetch()` (browser via `/api/rpc` proxy). **Native DEX** pages call **`boing-sdk`** on the server (`GET /api/dex/snapshot`, `POST /api/dex/quote`) so routing math matches the network monorepo.
- Network selection is persisted in local storage.
- `?network=testnet|mainnet` is respected on page load, but `mainnet` is ignored unless a real mainnet RPC is configured.
- When RPC is unavailable, the UI shows a friendly network-unavailable message instead of failing silently.
- Search treats `64`-char hex input as block hash first, then falls back to account address.
- Hex values are normalized for links and copied values.
- Account balances use whole BOING units (`0` display decimals); RPC returns u128 strings as on-chain.

## Architectural Notes

### Important implementation characteristics

- The explorer is mostly a thin RPC client; **minimal API routes** proxy JSON-RPC for CORS and run **DEX** snapshots/quotes server-side.
- Most chain data is fetched directly in client components.
- Stats and charts fetch a recent block sample by making multiple RPC calls from the browser.
- The app is intentionally thin and RPC-driven, which keeps it simple but also makes performance and feature scope dependent on the RPC surface.

### Durable indexer (OBS-1) — product boundary

Normative specs for ingestion, SQL storage, reorgs, and a read API live in **`boing.network`** ([OBSERVER-HOSTED-SERVICE.md](https://github.com/Boing-Network/boing.network/blob/main/docs/OBSERVER-HOSTED-SERVICE.md), [INDEXER-RECEIPT-AND-LOG-INGESTION.md](https://github.com/Boing-Network/boing.network/blob/main/docs/INDEXER-RECEIPT-AND-LOG-INGESTION.md)). That monorepo intentionally does **not** ship the long-running hosted ingestion worker today: it owns the chain, RPC, **`boing-sdk`**, docs, and website—not the OBS-1 data plane unless scope is explicitly expanded there.

**Who builds the indexer:** treat it as a **separate product** from the node and from **boing.express** (wallets sign and call RPC; they may deep-link to explorer/indexer URLs but should not own chain indexing). Practical ownership patterns: (A) this repo or an adjacent worker/DB in the same org as the explorer, (B) a small dedicated repo (e.g. indexer service) that **boing.observer** and optionally partners call over HTTP, or (C) an internal platform/infra team equivalent to B. Pick one pattern and keep it stable.

**This explorer** stays on **bounded RPC + SDK** for DEX-style and similar views until a real index exists; that matches the spec and does **not** push OBS-1 work back onto **boing.network** or **boing.express**.

### Deployment and infra

- Target deployment is `Cloudflare Workers`.
- `NEXT_PUBLIC_TESTNET_RPC` and `NEXT_PUBLIC_MAINNET_RPC` define network endpoints.
- The explorer no longer silently maps `mainnet` to the testnet RPC when mainnet is unset.
- The project currently relies on `--legacy-peer-deps` and `--dangerouslyUseUnsupportedNextVersion` because the Cloudflare adapter version in use targets newer Next.js releases than the app currently uses.

### Documentation and branding

- Canonical site URL is `https://boing.observer`.
- External Boing docs are assumed to live in the `boing.network` repo under `docs/`.
- The explorer already references those docs for QA and security-related guidance.
- `boing.network` now also contains the current portal wallet-auth and wallet-provider guidance, so explorer UX should align with those conventions instead of inventing a separate connection model later.

### Current cross-project reality

The explorer is still read-only, but the broader Boing ecosystem is no longer just static docs plus RPC:

- `boing.network` now has a live testnet portal sign-in page at `/testnet/sign-in`.
- The portal supports nonce-backed wallet authentication using Ed25519 signatures verified in backend functions.
- The documented preferred wallet provider methods are:
  - `boing_requestAccounts`
  - `boing_signMessage`
  - `boing_chainId`
  - `boing_switchChain`
- Compatibility fallback to `eth_requestAccounts`, `personal_sign`, `eth_chainId`, and `wallet_switchEthereumChain` is documented for wallets that expose Ethereum-style aliases.
- The portal currently attempts Boing testnet chain ID `0x1b01` before wallet-based sign-in.

This matters even though the explorer does not require authentication today. Any future authenticated explorer features, wallet connect affordances, faucet shortcuts, or cross-app account actions should reuse the same provider and signing contract already documented in `boing.network`.

## Constraints and Gaps

The explorer is usable today, but there are several notable limitations:

- No validator page, proposer page, or staking leaderboard.
- No contract page, token page, NFT page, or asset metadata layer.
- No indexed search beyond height/hash/account heuristics.
- No server-side caching or indexer-backed querying.
- No historical analytics beyond the recent block samples fetched in-browser.
- No mempool visibility.
- No address labeling or known-entity tagging.
- No wallet-aware deep linking from explorer views.
- Expand Playwright coverage (account/tx flows, mobile nav) beyond `e2e/smoke.spec.ts`.

## What `boing.network` Should Know

The website project should treat `boing.observer` as the canonical live explorer entry point for chain state and public transparency tooling.

Useful coordination points:

- Keep protocol docs in `boing.network/docs` stable and canonical.
- Maintain stable public links for:
  - RPC specification
  - QA pass guide
  - canonical malice definition
  - security standards
- Treat the following docs as the current source of truth for wallet connection and sign-in behavior:
  - `WALLET-CONNECTION-AND-SIGNIN.md`
  - `PORTAL-WALLET-AUTH-ROLLOUT.md`
  - `BOING-OBSERVER-AND-EXPRESS-BUILD.md`
- Link prominently to the explorer from the website navigation and launch pages.
- Link the faucet and QA tooling from docs, validator onboarding, and developer onboarding.
- Publish canonical chain metadata in one place:
  - chain name
  - chain ID
  - native token symbol/decimals
  - RPC endpoints
  - explorer base URL
  - faucet URL
  - wallet URL
- Keep portal, docs, wallet, and explorer aligned on:
  - address format (`0x` + 32-byte hex)
  - native wallet provider method names
  - message-signing expectations for authentication
  - network naming for `testnet` and `mainnet`
  - deep-link destinations between website, wallet, and explorer

## What `boing.express` Should Know

The wallet project can already integrate with the explorer even before any deeper protocol changes are made.

Immediate wallet integration opportunities:

- Add deep links from wallet account pages to `boing.observer/account/[address]`.
- Add deep links from wallet transaction receipts to future explorer transaction pages.
- Use the same canonical network metadata and endpoint definitions as the explorer.
- Make faucet access discoverable from the wallet on testnet.
- Link contract deployment workflows to the explorer's QA tool or embed equivalent QA guidance in-wallet.
- Align address formatting and copy behavior across wallet and explorer.
- Support the portal's preferred provider API so wallet connection works consistently across `boing.network` and any future explorer connect flow:
  - `boing_requestAccounts`
  - `boing_signMessage`
  - `boing_chainId`
  - `boing_switchChain`
- Preserve compatibility aliases where practical:
  - `eth_requestAccounts`
  - `personal_sign`
  - `eth_chainId`
  - `wallet_switchEthereumChain`
- Be able to sign the nonce-backed multiline portal auth message format documented in `boing.network/docs/WALLET-CONNECTION-AND-SIGNIN.md`.
- Recognize Boing testnet chain ID `0x1b01` so wallet-driven sign-in and network switching do not drift from the website.

## Recommended Ecosystem Improvements

These are the enhancements most likely to improve the total Boing user and developer experience across explorer, website, wallet, and chain infrastructure.

### Highest priority

1. Add transaction detail support to the protocol and explorer
   - The explorer currently shows transactions only as rows inside block pages.
   - A dedicated transaction hash / receipt RPC and route would materially improve usability.
   - This would unlock wallet receipt deep links and website support docs that reference concrete transactions.

2. Create a shared chain metadata package or canonical config source
   - `boing.network`, `boing.express`, and `boing.observer` should not drift on chain ID, symbol, decimals, RPC URLs, or domain links.
   - A shared config package or versioned JSON source would reduce inconsistency.
   - This source should also cover wallet-provider conventions where possible, not just endpoints.

3. Introduce an indexer or cached data layer
   - Browser-driven multi-call RPC sampling is fine now, but an indexed layer will become important as usage grows.
   - This would enable richer search, faster pages, token/contract views, and better charts.

4. Standardize explorer deep linking across the ecosystem
   - Website docs should link users into account/block/transaction views.
   - Wallet should link to explorer pages after sends, receives, stake actions, QA checks, and faucet requests.
   - Portal pages should link signed-in users to the relevant explorer views for their account and future transaction receipts.

5. Standardize wallet-connect and auth UX across website and explorer
   - The explorer does not need auth for normal browsing, but if it later adds account-aware actions, saved views, faucet shortcuts, QA submission helpers, or gated tools, it should reuse the nonce-based sign-in and provider conventions already documented in `boing.network`.
   - Reusing one sign-in message shape, one chain-selection expectation, and one provider API contract will reduce user confusion and wallet-side edge cases.

### Strongly recommended

6. Add validator and staking visibility
   - Validator directory
   - proposer history
   - stake distribution
   - validator status and uptime
   - slashing or equivocation visibility if applicable

7. Add contract and asset discovery
   - contract pages
   - verified source / metadata if available
   - token pages
   - NFT collection pages
   - contract deployment provenance

8. Build a richer search model
   - search by tx hash
   - search by validator ID
   - search by contract address
   - search by token symbol or collection name once indexer support exists

9. Add environment and network health visibility
   - public RPC status page
   - per-network uptime status
   - block production health
   - latency and error-rate metrics

10. Add automated testing and CI quality gates
   - commit an ESLint config
   - add smoke tests for route rendering
   - add RPC contract tests or mocked integration tests
   - add build + lint + typecheck CI gating

### Nice next steps

11. Improve developer onboarding
   - canonical "start here" page across website, wallet, and explorer
   - one shared doc for network endpoints and tooling
   - wallet-to-faucet-to-explorer onboarding flow

12. Add human-friendly labels and registry data
   - known validators
   - core contracts
   - faucet account
   - governance or treasury accounts
   - ecosystem app contracts

13. Add historical analytics
   - TPS over time
   - active addresses
   - gas usage
   - contract deployments
   - validator participation

## Suggested Work Split By Repo

### In `boing.observer`

- Add transaction detail pages.
- Add validator and contract pages.
- Replace browser-only multi-call analytics with cached/indexed data.
- Add tests and a committed ESLint config.
- Add wallet/explorer deep link helpers.
- If any account-aware UX is added, reuse the same wallet-connect and nonce-sign-in contract already documented in `boing.network` rather than introducing explorer-specific auth behavior.

### In `boing.network`

- Publish and maintain canonical docs and chain metadata.
- Feature explorer links in navigation, launch docs, validator docs, and developer docs.
- Host or document a public status page for RPC and network health.
- Keep external documentation URLs stable so the explorer can link to them safely.
- Keep the wallet-auth docs authoritative and current as the provider API or chain IDs evolve.
- Add obvious account-level links from the portal and testnet UX into the explorer where it improves trust and transparency.

### In `boing.express`

- Add explorer links for accounts, transfers, stake events, and future tx receipts.
- Surface faucet actions on testnet.
- Align address presentation and copy UX with the explorer.
- Reuse the same network metadata source and endpoint definitions.
- Optionally integrate QA guidance into deploy or advanced tooling flows.
- Implement the Boing-native provider methods used by the portal and keep alias compatibility where helpful.
- Match the portal's nonce-backed sign-in message expectations so wallet auth works consistently across Boing properties.

## Recommended Immediate Next Actions

If another agent picks this up in `boing.network` or `boing.express`, the highest-value next actions are:

1. Establish one canonical source of chain metadata shared by all Boing apps.
2. Add explicit explorer deep links inside the wallet and website.
3. Freeze and document the shared wallet-provider/auth contract so website, wallet, and future explorer connect flows do not drift.
4. Define or expose a transaction lookup RPC and plan the explorer transaction page.
5. Decide whether Boing will stay RPC-only for the explorer or invest in an indexer layer.
6. Commit ESLint configuration and start minimal CI checks in the explorer repo.

## Short Version

`boing.observer` is already a solid first-version explorer with block, account, stats, charts, QA, faucet, and SEO support. The biggest ecosystem wins now are shared chain metadata, one consistent wallet/provider/auth contract across Boing properties, better cross-linking between website/wallet/explorer, transaction-level visibility, and an eventual indexing/caching layer for richer search and analytics.

---

## Sync review (2026-03-06)

This section records the concrete sync pass performed against the current `boing.network` docs and portal rollout.

### Fixed in this repo

- Replaced stale QA links with the canonical `QUALITY-ASSURANCE-NETWORK.md` doc in `boing.network`.
- Updated QA wording to match the current Boing terminology: `allow`, `reject`, `unsure`, community QA pool.
- Surfaced `doc_url` from `boing_qaCheck` responses when provided by the node.
- Added optional `description_hash` input support to the explorer QA pre-flight UI.
- Added advanced optional `asset_name` and `asset_symbol` QA metadata inputs, with guardrails around parameter ordering.
- Removed the misleading mainnet fallback behavior; mainnet is only selectable when configured.
- Updated network selector and persisted network handling accordingly.
- Clarified that the explorer faucet is a direct RPC helper; canonical public faucet lives on `boing.network`.
- De-emphasized the explorer faucet in navigation in favor of the canonical faucet page.
- Added explicit wallet-integration notes for future account-aware features.

### Still documented, not changed yet

- The explorer still contains its own faucet helper route for advanced/direct RPC use.
- The explorer does not implement wallet connect today; future account-aware features should reuse the provider and auth contract in `boing.network/docs/WALLET-CONNECTION-AND-SIGNIN.md` and `PORTAL-WALLET-AUTH-ROLLOUT.md`.
- A shared cross-app metadata/config source is still recommended (see [THREE-CODEBASE-ALIGNMENT.md](https://github.com/Boing-Network/boing.network/blob/main/docs/THREE-CODEBASE-ALIGNMENT.md) in boing.network).

---

## Wallet integration notes

`boing.observer` does not implement wallet connect today. Any future account-aware explorer features should stay aligned with the current Boing website and wallet contract.

### Use the existing Boing contract

If the explorer later adds wallet-aware features (account shortcuts, faucet autofill, saved watchlists, authenticated QA helper flows, transaction receipt linking, user sessions), it should reuse the same provider and sign-in conventions documented in `boing.network`.

Preferred provider methods: `boing_requestAccounts`, `boing_signMessage`, `boing_chainId`, `boing_switchChain`. Compatibility aliases: `eth_requestAccounts`, `personal_sign`, `eth_chainId`, `wallet_switchEthereumChain`.

### Testnet expectations

- Current Boing public rollout is testnet-first.
- Portal sign-in expects Boing testnet chain ID `0x1b01`.
- Account format is `0x` + 32-byte hex.
- Authentication should verify an Ed25519 signature against the account public key.

### Sign-in message shape

If the explorer ever needs user authentication, reuse the nonce-backed message format used by the portal (see `boing.network/docs/WALLET-CONNECTION-AND-SIGNIN.md` and `PORTAL-WALLET-AUTH-ROLLOUT.md`). Avoid drifting provider methods, chain checks, or message formats across boing.network, boing.express, and boing.observer.
