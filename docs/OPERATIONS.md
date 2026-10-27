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
| `NEXT_PUBLIC_BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT` | build | Optional fallback. Height at which per-contract storage trees switch to 256-bit routing (node env `BOING_STORAGE_TREE_V2_ACTIVATION_HEIGHT`, consensus-wide, OFF by default). Newer nodes publish it as `storage_tree_v2_activation_height` in `boing_getNetworkInfo`, which takes precedence; with neither, the layout is "unknown" and no storage-layout claims are made |
| `NEXT_PUBLIC_BOING_RECEIPT_RETENTION_BLOCKS` | build | Optional fallback. Mirror of the node `BOING_RECEIPT_RETENTION_BLOCKS` (default 1000000; `0` = keep all). Newer nodes publish `receipt_retention_blocks` in `boing_getNetworkInfo`, which takes precedence. Only changes wording of the null-receipt hint |
| `BOING_OBSERVER_RATE_LIMIT` | server | `off` disables `/api/*` rate limiting (default on) |
| `BOING_OBSERVER_RATE_LIMIT_SCALE` | server | Multiplier for the per-isolate in-memory limits (default `1`; use `2`-`5` behind a shared NAT/proxy). Does **not** change the fixed limits of the Workers Rate Limiting bindings in `wrangler.toml` |
| `BOING_OBSERVER_CSP` | server | `nonce-enforce` (default, also for unset/unrecognised values), `report-only` (rollback), `nonce-report-only`, `off` (see Security). Set it in `wrangler.toml [vars]`: `wrangler deploy` overwrites dashboard-only variables |
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
| `npm run sync:chain-metadata` | Refresh `src/data/chain-metadata.json` from a sibling `boing.network` checkout (`git show main:docs/chain-metadata.json`), else GitHub raw; accepts a path or URL; refuses unknown `schema_version`. Review the diff, then run unit tests |
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
  `API_RATE_LIMITER*` (declared in `wrangler.toml`, set up in "Rate limiting setup" below; both layers must allow a request) and/or Cloudflare WAF rate rules.
- **CSP** (`src/middleware.ts`, `src/lib/csp.ts`): the static baseline in `security-headers.mjs` (`base-uri`, `object-src`, `form-action`,
  `frame-ancestors`) plus an **enforcing** `Content-Security-Policy` from middleware by default (`BOING_OBSERVER_CSP=nonce-enforce`):
  `script-src 'self' 'nonce-<per request>' 'strict-dynamic' 'wasm-unsafe-eval'`, `connect-src 'self'` (all client RPC goes through
  `/api/rpc`), `img-src`/`media-src` `https:` (NFT media from any gateway), `frame-src 'self'` (same-origin PDFs), `style-src` allows inline styles.
  Next stamps its own inline bootstrap scripts with the request nonce **only on dynamically rendered pages**, so the root layout is
  `export const dynamic = "force-dynamic"`: every page is server-rendered per request and HTML is not CDN-cached (static assets under
  `/_next/static` still are). JSON-LD blocks are data, not scripts. **Rollback without code changes:** set `BOING_OBSERVER_CSP=report-only`
  (inline scripts allowed, nothing blocked, violations still reported) in `wrangler.toml [vars]` and redeploy, or `wrangler rollback`.
  Violations are logged by `/api/csp-report` (see `wrangler tail`); after a deploy, watch it for a day. To summarize a capture (grouped by directive and blocked origin, with page paths), run `npx wrangler tail boing-observer --format json > csp.log` while traffic flows, then `npm run csp:summary -- csp.log` (add `--exclude smoke-test` to set aside the synthetic post-deploy report; excluded reports are still counted separately). **There is nothing to delete:** the route stores nothing, so a report such as the "smoke-test" one is just a log line that ages out of `wrangler tail` / Workers Logs retention; filter it with `--exclude` instead. Third-party scripts are not
  allowed: any new analytics/widget needs a deliberate `script-src` change in `src/lib/csp.ts` plus a test. Coverage: `e2e/csp.spec.ts`
  (headers, nonce on every script, no `securitypolicyviolation` on nine routes, inline handlers blocked, https images allowed).
- Bodies from third-party gateways (token metadata, blob error text) are read with `src/lib/bounded-body.ts`: the size cap is applied
  while streaming, before the body is buffered.

## Rate limiting setup (Cloudflare)

`wrangler.toml` declares three Workers Rate Limiting bindings (per client IP, 60 s windows). `src/lib/rate-limit.ts` picks the binding per route
bucket and falls back to `API_RATE_LIMITER` when a bucket's own binding is missing; with no binding at all (local dev, `next start`) only the
in-memory limiter applies, and a binding error never takes the API down.

| Binding | Limit | Buckets |
|---------|-------|---------|
| `API_RATE_LIMITER` (namespace `7101`) | 240 / 60 s | `/api/rpc`, other `/api/*` (the in-memory 120 still applies per isolate), `/api/csp-report` |
| `API_RATE_LIMITER_HEAVY` (`7102`) | 60 / 60 s | `account/history`, `account/nfts`, `asset/*`, `tokens/index`, `contract/interface`, `dex/*`, `blob/*` |
| `API_RATE_LIMITER_VOTE` (`7103`) | 10 / 60 s | `/api/qa/vote` |

Setup notes:

- `namespace_id` is a positive-integer **string** that must be unique across the whole Cloudflare account; every Worker that declares the same id
  shares one counter. Before the first deploy, check that `7101`-`7103` are unused in your other Workers' `wrangler.toml` files (the dashboard has no
  list of namespaces) and renumber in `wrangler.toml` if not. There is nothing to create in the dashboard; the namespace exists once a Worker declares it.
- `period` can only be `10` or `60` seconds, and one binding has one fixed limit, which is why three bindings exist. `BOING_OBSERVER_RATE_LIMIT_SCALE` does
  not change them; edit `wrangler.toml` and redeploy to retune.
- Counts are per Cloudflare location (not global) and eventually consistent, so treat them as a good ceiling rather than exact accounting.
- Validate without deploying: `npx wrangler deploy --dry-run` lists `env.API_RATE_LIMITER (240 requests/60s)` etc. (run `npx opennextjs-cloudflare build` first). `npx wrangler dev --local` supplies local rate limit bindings.
- **Equivalent Cloudflare WAF rate-limiting rules** (Security -> WAF -> Rate limiting rules; use these instead of, or on top of, the bindings: they act before the
  Worker runs and are billed/limited by plan, e.g. the Free plan allows few rules and a 10 s period). Characteristic: IP; action: Block (or Managed Challenge)
  for 60 s with a `429` response.

  | Rule | Expression | Rate |
  |------|------------|------|
  | rpc | `http.request.uri.path eq "/api/rpc"` | 240 requests / 1 min |
  | heavy | `starts_with(http.request.uri.path, "/api/account/history") or starts_with(http.request.uri.path, "/api/account/nfts") or starts_with(http.request.uri.path, "/api/asset/") or starts_with(http.request.uri.path, "/api/tokens/index") or starts_with(http.request.uri.path, "/api/contract/interface") or starts_with(http.request.uri.path, "/api/dex/") or starts_with(http.request.uri.path, "/api/blob/")` | 60 / 1 min |
  | vote | `http.request.uri.path eq "/api/qa/vote"` | 10 / 1 min |
  | csp-report | `http.request.uri.path eq "/api/csp-report"` | 20 / 1 min |
  | other API | `starts_with(http.request.uri.path, "/api/")` (place last) | 120 / 1 min |

## Indexing and caching

- In-process RPC memoisation: `src/lib/rpc-cache.ts` (bounded, TTL).
- Token index snapshots: disk cache (`TOKEN_INDEX_CACHE_*`), best effort. Not durable on Workers.
- Account history: `boing_getAccountTransactions` (cursor paging), block-scan fallback for older nodes.
- **Receipt retention:** nodes keep receipts for the newest `BOING_RECEIPT_RETENTION_BLOCKS` blocks (default 1,000,000, pruned every
  256 blocks; `0` keeps all) and `boing_getTransactionReceipt` returns `null` beyond that, which is indistinguishable from an unknown
  id. `/tx/:id` therefore reads the chain head and says either "unknown / pending / other network" or "may have been pruned (older
  than about block #N)". Blocks, headers and signed payloads are never pruned. **Indexing note:** an indexer or archive explorer
  must not rely on receipt lookups for history. Backfill by walking `boing_getBlockByHeight` (the explorer's block fetch can
  include receipts) while the node still holds them, or run the node with `BOING_RECEIPT_RETENTION_BLOCKS=0`.
- NFT ownership: optional external indexer Worker (`NFT_OWNER_INDEXER_URL`); without it the API returns 503 and the UI
  explains how to enable it.

## Chain metadata, proofs and storage-tree v2

- **Chain metadata:** `src/data/chain-metadata.json` (schema_version 1) is the single source for chain ids, native currency and
  explorer/wallet/faucet URLs (`src/lib/chain-metadata.ts`, consumed by `chain-ids.ts`). Upstream changes are a deliberate upgrade:
  `npm run sync:chain-metadata`, review, test. `/tools/node-health` warns (`chain-id-mismatch`) when a node reports a chain id
  different from the metadata, and shows `client_hints` (min/recommended wallet version, recommended SDK) as advisory text.
  `/tools/rpc-catalog` renders `protocol_specs` (additive-only; unknown sections are listed generically).
- **Account proofs:** `/tools/account-proof` calls `boing_getAccountProof` and `boing_verifyAccountProof` (both allow-listed) and
  compares the proof `root` with the `state_root` of the newest 3 blocks. The node verifies its own proof, so this is a
  consistency check, not trust-minimized; the page says so and recommends a second independent node. Older nodes without the
  methods get a plain explanation.
- **Storage-tree v2:** newer nodes publish `storage_tree_v2_activation_height` in `boing_getNetworkInfo` (and `boing_health`): an integer H, or
  `null` = not configured (legacy 64-bit routing everywhere). `src/lib/storage-tree.ts` prefers that value, then the optional build env
  above; older nodes omit the key, which means "unknown" (the key is looked up at the top level or one object deep, so a nesting change
  does not break it). Block pages and the proof tool say whether a height uses the legacy 64-bit or the 256-bit layout (`null` is reported
  as "not scheduled"). The home page "Chain tip" card also compares H with the committed head (`describeActivationStatus`): before H it reads "not yet active ... (N blocks to go)", from H it reads "active since height H". The proof format is the same, only longer, and verification does not depend on the layout. When unknown, nothing is claimed.
- **Receipt retention (node info):** `receipt_retention_blocks` is an integer window or `null` = unbounded. `/tx/:id` prefers it over the build
  env, says "this node reports keeping receipts for the newest N blocks", and never suggests pruning for `null`/`0`.

## Updating for network changes

1. Read `crates/boing-node/src/rpc.rs` and `schemas/developer_api.json` in boing.network.
2. Update `src/lib/rpc-types.ts`, decoders and tests; bump `@boing-network/boing-sdk` if needed.
3. Add new browser-callable methods to the proxy allow-list.
4. If `docs/chain-metadata.json` changed in boing.network, run `npm run sync:chain-metadata`.
5. Run lint, typecheck, unit, build, e2e; update HANDOFF.md's sync table.

## Deploy checklist (prepared, not executed)

**Important: a push to `main` deploys.** `.github/workflows/ci.yml` runs `npm run deploy` (OpenNext build + `wrangler deploy`) in the `deploy` job after the
`quality` job passes on every push to `main`, so merging or pushing to `main` publishes to Cloudflare without a separate step. To publish manually
instead, change that job to `workflow_dispatch`/tag-only first. The checklist below is the same sequence done by hand; nothing in it has been run for
the observer-4 changes.

Pre-flight (repo root, on an up-to-date `main`):

```
git switch main && git pull --ff-only
npm ci --legacy-peer-deps
npm run lint && npm run typecheck && npm test
npm run build
npx playwright test            # needs the fresh build above; CI=1 makes it start its own server
```

Config checks:

- `wrangler.toml`: namespace ids `7101`-`7103` are unused elsewhere in the Cloudflare account (see "Rate limiting setup").
- `BOING_OBSERVER_CSP` is unset (= `nonce-enforce`) or deliberately set; keep a rollback value ready (`report-only`).
- Build-time variables are set as in CI: `NEXT_PUBLIC_TESTNET_RPC`, `NEXT_PUBLIC_MAINNET_RPC` (and optionally the storage-tree / retention fallbacks).
- Optional: `npm run sync:chain-metadata` once boing.network publishes new chain metadata (the unit test that compares with a sibling checkout fails while that
  checkout has unpublished metadata edits; it is skipped in CI).

Build and validate the Worker without publishing:

```
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run --outdir .wrangler-dryrun    # lists bindings incl. the three rate limit bindings; uploads nothing
npx wrangler dev --local --port 8787                       # optional: run it in workerd, then curl http://127.0.0.1:8787/about
```

Deploy (authenticated as the account that owns the `boing-observer` Worker):

```
npx wrangler login                    # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npx opennextjs-cloudflare build
npx wrangler deploy                   # equivalent: npm run deploy (build + deploy)
```

Smoke test right after the deploy (replace the host):

```
curl -sI https://boing.observer/about | grep -i content-security-policy     # enforcing header with script-src ... 'nonce-...' 'strict-dynamic'
curl -s https://boing.observer/tokens | grep -o '<script[^>]*>' | grep -vc nonce   # expect 0 (JSON-LD aside)
for i in $(seq 1 12); do curl -s -o /dev/null -w '%{http_code} ' https://boing.observer/api/qa/vote; done   # 429 after 10 (your IP)
npx wrangler tail boing-observer --format pretty                             # watch /api/csp-report violations for a while
```

Then open `/`, `/tx/<id>`, `/tools/account-proof`, `/tools/node-health`, `/about` (PDF viewer) and an NFT page in a browser with the console open: there should be no
"Refused to ..." messages. Rollback: set `BOING_OBSERVER_CSP=report-only` in `wrangler.toml [vars]` and redeploy, or `npx wrangler rollback` to the previous version.

## Dependabot

Check with `gh api repos/Boing-Network/boing.observer/dependabot/alerts?state=open`. After the `optimize/observer-2` fixes
(vite 7.3.7, glob 10.5.0 override) the API reported 0 open alerts (100 fixed) while the repo banner still showed 6 for a while;
the banner lags the API. Re-run `npm audit` after any dependency change.