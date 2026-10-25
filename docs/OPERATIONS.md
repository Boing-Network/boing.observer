# Operations

Everything needed to configure, test, deploy and maintain boing.observer. Quick start is in [README.md](../README.md).

## Environment variables

Copy `.env.example` to `.env.local` for local work. For Cloudflare, set plain-text variables in `wrangler.toml [vars]` or the
dashboard, and secrets with `wrangler secret put`. `NEXT_PUBLIC_*` values are inlined at build time.

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_TESTNET_RPC` | build | Testnet RPC (default `https://testnet-rpc.boing.network/`) |
| `NEXT_PUBLIC_TESTNET_RPC_FALLBACKS` | build | Extra testnet origins (comma-separated); hosted Fly nodes are built-in fallbacks |
| `NEXT_PUBLIC_MAINNET_RPC` | build | Mainnet RPC. Leave unset until a distinct mainnet endpoint exists; never the testnet URL |
| `NEXT_PUBLIC_BOING_PROTOCOL_DOCS_REPO` | build | `owner/repo` for doc links on `/qa` (default `Boing-Network/boing.network`) |
| `NEXT_PUBLIC_BOING_LINKED_NFT_TOKEN_REGISTRY` (alias `BOING_LINKED_NFT_TOKEN_REGISTRY`) | build/server | Linked NFT/token registry AccountId override (testnet v2 default baked in) |
| `NEXT_PUBLIC_BOING_BUILDER_ATTESTATION_REGISTRY` | build | Builder attestation registry AccountId (UI not shipped yet) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION` | build | Search-console verification meta tags |
| `BOING_OPERATOR_RPC_TOKEN` | **secret** | Validator `X-Boing-Operator` value; server-only, never `NEXT_PUBLIC_` |
| `BOING_QA_VOTE_RPC` | server | Producing validator for `boing_qaPoolVote` (default `https://boing-testnet-1.fly.dev`) |
| `BOING_BLOB_DOWNLOAD_TOKENS` | **secret** | Comma-separated tokens for `GET /api/blob/download` (operator token also accepted) |
| `BOING_BLOB_DOWNLOAD_RPC` | server | Origin for raw `GET /v1/media/blob?id=...` (default Fly `boing-testnet-1`) |
| `NFT_OWNER_INDEXER_URL` (alias `BOING_NFT_OWNER_INDEXER_URL`) | server | Origin of the NFT owner indexer Worker; enables `/api/account/nfts` |
| `BOING_OBSERVER_ALLOW_DEX_DIAGNOSTICS` | server | `1` returns DEX diagnostics on `/api/dex/*`; set as plain text, not secret |
| `BOING_NATIVE_VM_DEX_FACTORY` / `BOING_DEX_FACTORY_HEX` | server | `0x` + 64 hex DEX factory override for discovery (normally resolved from `boing_getNetworkInfo`) |
| `TOKEN_INDEX_CACHE_DIR` | server | Token index disk cache dir (default `<cwd>/.cache/token-index`; `off` disables) |
| `TOKEN_INDEX_CACHE_TTL_SEC` (alias `..._SECONDS`) | server | Token index cache TTL (default 600, max 7 days) |
| `BOING_OBSERVER_RATE_LIMIT` | server | `off` disables `/api/*` rate limiting (default on) |
| `BOING_OBSERVER_RATE_LIMIT_SCALE` | server | Multiplier for every per-route limit (default `1`; use `2`-`5` behind a shared NAT/proxy) |
| `BOING_OBSERVER_CSP` | server | `report-only` (default), `off`, `nonce-report-only`, `nonce-enforce` (see Security) |
| `TOKEN_METADATA_GATEWAY_URLS` | server | Extra comma-separated gateway templates with a `{hash}` placeholder for off-chain token metadata |

Test-only (Playwright): `PLAYWRIGHT_BASE_URL`, `OBSERVER_CONTRACTS_LIVE=1`, `OBSERVER_NAMES_LIVE=1` (run the live testnet
specs), `CONTRACT_SHOTS=1`, `NAMES_SHOTS=1` (screenshots), `CI`.

## Scripts and commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next.js on :3000 |
| `npm run lint` | ESLint (`eslint . --ext .ts,.tsx,.js,.jsx,.mjs`) |
| `npm run typecheck` | `tsc --noEmit` (tests excluded) |
| `npm test` / `npm run test:watch` | Vitest unit tests (`src/**/*.test.ts(x)`) |
| `npm run build` / `npm start` | Production build / server |
| `npm run test:e2e` | Playwright; runs against `npm run start` on 127.0.0.1:3000 with mocked RPC (`e2e/fixtures/rpc-mock.ts`). Build first |
| `npm run preview` | OpenNext build running in the Workers runtime |
| `npm run deploy` / `npm run upload` | OpenNext build + `wrangler deploy` / version upload |
| `npm run cf-typegen` | Regenerate Cloudflare env types |
| `npm run generate:brand-assets` | `scripts/generate-brand-assets.mjs` |
| `npm install` (postinstall) | `scripts/copy-pdf-worker.mjs` copies the pdf.js worker so PDFs stay same-origin |
| `python scripts/generate-seo-assets.py` | OG image, favicon, apple-touch icon (needs `pip install -r requirements-seo.txt`) |
| `python scripts/generate-qa-gate-rules-pdf.py` | Render `docs/QA-GATE-RULES.md` to a PDF (needs `pip install markdown fpdf2`; not in `requirements-seo.txt`) |
| `npx vite-node scripts/gen-published-interfaces.ts -- <outDir> [rpcUrl]` | Generate canonical interface JSONs for the on-chain interface registry |

`npm ci --legacy-peer-deps` is required (the Cloudflare adapter's peer range lags Next 15).

## CI and deploy

`.github/workflows/ci.yml`: on push/PR runs install, lint, typecheck, unit tests, build, Playwright. On `main`, a deploy
job runs after CI with secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and variables `NEXT_PUBLIC_TESTNET_RPC`,
`NEXT_PUBLIC_MAINNET_RPC`. Manual deploy: `npx wrangler login && npm run deploy`. The domain is attached under
Workers & Pages -> boing-observer -> Domains & Routes.

## Security and abuse controls

- Global headers: `security-headers.mjs` (see [HANDOFF.md](../HANDOFF.md)). Changing them requires updating
  `src/lib/security-headers.test.ts`.
- `/api/rpc` policy is in `src/lib/rpc-proxy-policy.ts` (allow-list, param/id validation, size caps). To expose a new method
  to the browser, add it to `ALLOWED_RPC_METHODS` and its test.
- **Rate limiting** (`src/middleware.ts` + `src/lib/rate-limit.ts`), per client IP (`cf-connecting-ip`, then `x-real-ip` / `x-forwarded-for`), fixed one-minute windows:
  `/api/rpc` 240, heavy routes (`account/history`, `account/nfts`, `asset/*`, `tokens/index`, `contract/interface`, `dex/*`, `blob/*`) 60,
  `/api/qa/vote` 10, `/api/csp-report` 20, other `/api/*` 120. Over the limit returns `429` with `Retry-After` and
  `code: "rate_limited"`; the explorer client shows "Too many requests. Try again in N seconds." and does not auto-retry a
  `Retry-After` > 1 s. **Caveat:** without a binding the counters live in each Worker isolate's memory, so the global limit is looser
  than configured and resets when an isolate is evicted. For a shared limit add the Workers Rate Limiting binding named
  `API_RATE_LIMITER` (sample commented in `wrangler.toml`; both layers must allow a request) and/or a Cloudflare WAF rate rule.
- **CSP**: static baseline in `security-headers.mjs` plus a `Content-Security-Policy-Report-Only` header from middleware. Violations are
  logged by `/api/csp-report` (see `wrangler tail`). The nonce modes only help on dynamic routes (prerendered pages cannot carry a
  per-request nonce), so enforcement is deliberately **not** enabled; the path to it is in HANDOFF.md.
- Bodies from third-party gateways (token metadata, blob error text) are read with `src/lib/bounded-body.ts`: the size cap is applied
  while streaming, before the body is buffered.

## Indexing and caching

- In-process RPC memoisation: `src/lib/rpc-cache.ts` (bounded, TTL).
- Token index snapshots: disk cache (`TOKEN_INDEX_CACHE_*`), best effort. Not durable on Workers.
- Account history: `boing_getAccountTransactions` (cursor paging), block-scan fallback for older nodes.
- NFT ownership: optional external indexer Worker (`NFT_OWNER_INDEXER_URL`); without it the API returns 503 and the UI
  explains how to enable it.

## Updating for network changes

1. Read `crates/boing-node/src/rpc.rs` and `schemas/developer_api.json` in boing.network.
2. Update `src/lib/rpc-types.ts`, decoders and tests; bump `@boing-network/boing-sdk` if needed.
3. Add new browser-callable methods to the proxy allow-list.
4. Run lint, typecheck, unit, build, e2e; update HANDOFF.md's sync table.