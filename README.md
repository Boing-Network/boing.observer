# Boing Observer — Blockchain Explorer

Blockchain explorer for **Boing Network** at **boing.observer**. Browse blocks, transactions, and accounts on testnet today, with mainnet support enabled when a distinct mainnet RPC is configured.

## Features

- **Network selector** — Testnet by default; Mainnet only appears as active when a distinct mainnet RPC is configured.
- **Home** — Current chain height and list of latest blocks.
- **Block page** — By height (`/block/:height`) or hash (`/block/hash/:hash`): header (hash, height, timestamp, proposer, parent hash, roots) and transaction list with type/sender/summary.
- **Account page** — Balance, nonce, and stake for a 32-byte hex address (`/account/:address`); optional **contract hints** from `boing_getNetworkInfo` (canonical pool/factory) and a zero-slot `boing_getContractStorage` probe.
- **Search** — By block height (number), block hash (64 hex), or account address (64 hex). Dispatches to the appropriate page (64-hex tries block-by-hash first, then account).
- **QA Check** — Pre-flight `boing_qaCheck` with optional purpose category, description hash, and advanced asset metadata fields, aligned to the canonical QA docs in `boing.network`.
- **Faucet helper** — Direct testnet RPC helper for `boing_faucetRequest`; the canonical public faucet landing page lives on `boing.network/faucet`, and the site navigation now points there first.
- **Native DEX (read-only)** — [`/dex/pools`](https://boing.observer/dex/pools) uses `boing-sdk` on the server for `fetchNativeDexDirectorySnapshot` with optional bounded `register_pair` logs; [`/dex/quote`](https://boing.observer/dex/quote) runs `fetchCpRoutingFromDirectoryLogs` / `findBestCpRoutes` for exploratory CP quotes (execution remains in wallets and dApps).
- **RPC catalog** — [`/tools/rpc-catalog`](https://boing.observer/tools/rpc-catalog) calls `boing_getRpcMethodCatalog` on the selected network to list methods the endpoint exposes (with links to the spec and alignment §2.1 when the catalog is missing).
- **Node health** — [`/tools/node-health`](https://boing.observer/tools/node-health) compares `boing_chainHeight`, `boing_getSyncState`, and optional `boing_health` (operator-facing limits and metrics).

## Tech stack

- **Next.js 15** (App Router), React 18, TypeScript
- **Tailwind CSS** with Boing design tokens (Cosmic Foundation: dark theme, Orbitron/Inter/JetBrains Mono, glass cards)
- **RPC** — Browser: same-origin proxy `POST /api/rpc` + JSON-RPC. Server routes: direct HTTP to configured RPC. **DEX tooling** also uses **`boing-sdk`** (vendored from the [`boing.network`](https://github.com/Boing-Network/boing.network) monorepo via `postinstall`; see `scripts/sync-boing-sdk.mjs`).
- **Cloudflare** — Deploy via [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) to Workers; custom domain **boing.observer**

## Setup

1. Clone and install:

   ```bash
   npm install --legacy-peer-deps
   ```

   (Use `--legacy-peer-deps` because the Cloudflare adapter targets Next 15+; see [Hosting on Cloudflare](#hosting-on-cloudflare-boingobserver).)

   Lint and unit tests (optional locally; **also run in CI** before deploy on `main`):

   ```bash
   npm run lint
   npm run test
   ```

   End-to-end smoke (Chromium; starts `next` production server automatically):

   ```bash
   npm run build
   npm run test:e2e
   ```

2. Copy env (includes live testnet RPC by default):

   ```bash
   cp .env.example .env.local
   ```

3. Run:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Config

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_TESTNET_RPC` | Testnet RPC base URL (e.g. `https://testnet-rpc.boing.network/`). |
| `NEXT_PUBLIC_MAINNET_RPC` | Mainnet RPC base URL. **Leave unset** until a distinct mainnet endpoint is published — never set this to the testnet URL ([THREE-CODEBASE-ALIGNMENT.md](https://github.com/Boing-Network/boing.network/blob/main/docs/THREE-CODEBASE-ALIGNMENT.md)). |

No API keys required for read-only RPC. Do not hardcode production RPC URLs in the repo; use `.env.local` or hosting env.

Important: if `NEXT_PUBLIC_MAINNET_RPC` is unset or equals the testnet URL, the explorer keeps users on testnet and does not treat “mainnet” as live.

### RPC URL, retries, and “Method not found”

- **Default:** When `NEXT_PUBLIC_TESTNET_RPC` is unset, the app uses **`https://testnet-rpc.boing.network`** (see `src/lib/rpc-client.ts`). The browser calls **`POST /api/rpc`**, which forwards to that configured base URL server-side.
- **Retries:** The JSON-RPC client retries **once** after a short delay only for **transient** cases (network errors, HTTP 429, 5xx). It does **not** switch to a second RPC hostname or alternate URL.
- **`Method not found` / missing methods:** There is **no** automatic failover to another node. Surfaces such as **QA transparency** (`/qa`) still show **canonical QA JSON and doc links** when `boing_getQaRegistry` (or related calls) fail — see [THREE-CODEBASE-ALIGNMENT.md §2.1](https://github.com/Boing-Network/boing.network/blob/main/docs/THREE-CODEBASE-ALIGNMENT.md#21-qa-registry-rpc-boing_getqaregistry--two-different-surfaces) (*local VibeMiner / `127.0.0.1:8545` vs public testnet RPC*). Upgrading the **public** RPC backend is an infra task; updating only a local node does not change what the explorer calls.
- **Native DEX directory (optional future):** A Cloudflare Worker can serve cursor-paginated **`GET /v1/directory/meta`** and **`/v1/directory/pools`** (materialized indexer view, not a full subgraph). See [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](https://github.com/Boing-Network/boing.network/blob/main/docs/HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md) in the protocol repo; this explorer’s **`/dex/pools`** path still uses **`boing-sdk`** against RPC today.

## Testnet launch readiness

For the Boing incentivized testnet launch, the following must be in place for the explorer (and other apps) to work:

| Item | Status | Notes |
|------|--------|-------|
| **Public testnet RPC** | Required | At least one stable URL (e.g. `https://testnet-rpc.boing.network`). Set in `NEXT_PUBLIC_TESTNET_RPC`. |
| **boing-node** | Required | Validators and full nodes must run `boing-node`; RPC on port 8545. |
| **Genesis / chain ID** | Required | Chain must be live and producing blocks. |
| **Faucet** | Recommended | Testnet BOING for validators and developers. |
| **Explorer configured** | Ready | Set `NEXT_PUBLIC_TESTNET_RPC` in Cloudflare Worker variables or GitHub Actions **Variables** / **Secrets** (see [INFRASTRUCTURE-SETUP.md](https://github.com/Boing-Network/boing.network/blob/main/docs/INFRASTRUCTURE-SETUP.md)). |

Until public RPC nodes are available, the explorer shows a friendly message: *"Boing Network nodes are not yet available"* and suggests running `boing-node` locally. When RPC is reachable, the status banner hides automatically.

## Hosting on Cloudflare (boing.observer)

This project is set up to deploy to **Cloudflare Workers** using the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare), so you can serve the explorer at **boing.observer**.

### Prerequisites

- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (included as dev dependency; v4.x).
- A Cloudflare account.
- The domain **boing.observer** added to Cloudflare (DNS managed by Cloudflare).

### Deploy from your machine

1. Log in to Cloudflare (first time only):

   ```bash
   npx wrangler login
   ```

2. Set production env (for the Worker’s runtime). Either:
   - Add `NEXT_PUBLIC_TESTNET_RPC` and `NEXT_PUBLIC_MAINNET_RPC` in **Cloudflare Dashboard** → Workers & Pages → your Worker → Settings → Variables, or  
   - Use [Wrangler secrets](https://developers.cloudflare.com/workers/configuration/secrets/) if you prefer CLI.
   - Optional: `NEXT_PUBLIC_BOING_PROTOCOL_DOCS_REPO` = `owner/repo` for GitHub links on `/qa` (defaults to `Boing-Network/boing.network` if unset).

3. Build and deploy:

   ```bash
   npm run deploy
   ```

   This runs `opennextjs-cloudflare build` then deploys the Worker. The first time, Wrangler will create a new Worker named **boing-observer** (see `wrangler.toml`).

4. Attach the custom domain **boing.observer**:
   - In **Cloudflare Dashboard** go to **Workers & Pages** → **boing-observer** → **Settings** → **Domains & Routes**.
   - Click **Add** and add **boing.observer** (and optionally **www.boing.observer**).  
   Cloudflare will create the DNS record and serve the explorer at **https://boing.observer**.

### Deploy from Git (GitHub Actions)

This repo includes a GitHub Actions workflow that deploys on every push to `main`. One-time setup:

1. **Create a Cloudflare API token** — [Cloudflare Dashboard](https://dash.cloudflare.com/) → **My Profile** → **API Tokens** → **Create Token** (use **Edit Cloudflare Workers** template).
2. **Get your Account ID** — In Cloudflare Dashboard, select any domain; Account ID is in the right sidebar under **API**.
3. **Add GitHub credentials** — Repo → **Settings** → **Secrets and variables** → **Actions**:
   - **Secrets (required):** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - **Variables (recommended for public RPC URLs):** `NEXT_PUBLIC_TESTNET_RPC` = `https://testnet-rpc.boing.network` or `https://testnet-rpc.boing.network/`; optional `NEXT_PUBLIC_MAINNET_RPC` only when mainnet RPC is live (must differ from testnet). The workflow uses **Variables first**, then **Secrets**, for those two `NEXT_PUBLIC_*` keys.
4. **Attach custom domain** (first deploy) — **Workers & Pages** → **boing-observer** → **Settings** → **Domains & Routes** → add **boing.observer**.

The **CI** workflow (`.github/workflows/ci.yml`) runs lint, unit tests, production build, and Playwright (Chromium) on every push and pull request to `main`. Pushes to `main` **deploy to Cloudflare only after** that quality job succeeds.

### Useful commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Local Next.js dev server. |
| `npm run build` | Next.js production build only. |
| `npm run test:e2e` | Playwright smoke tests (run `build` first; auto-starts `next start`). |
| `npm run preview` | Build with OpenNext and run locally in Workers runtime. |
| `npm run deploy` | Build and deploy to Cloudflare. |
| `npm run upload` | Build and upload a new version (for gradual deployments). |
| `npm run cf-typegen` | Generate Cloudflare env types into `cloudflare-env.d.ts`. |

### Worker size

Workers have a [size limit](https://developers.cloudflare.com/workers/platform/limits/#worker-size) (e.g. 3 MiB compressed on Free, 10 MiB on Paid). After `npm run deploy`, Wrangler prints the compressed size; if you hit the limit, consider moving to a Paid plan or trimming dependencies.

### Note on Next.js 14 and install

This app uses **Next.js 14**. The OpenNext Cloudflare adapter’s current release targets Next 15/16, so:

- Install with **`npm install --legacy-peer-deps`** to resolve peer dependency conflicts.
- Deploy scripts pass **`--dangerouslyUseUnsupportedNextVersion`** to the OpenNext build so the adapter accepts Next 14. When you upgrade to Next 15+, you can remove that flag and re-evaluate `--legacy-peer-deps`.

## SEO

The explorer is optimized for search engines and social sharing:

- **Metadata** — Title, description, keywords, Open Graph, and Twitter cards in the root layout.
- **Dynamic metadata** — Block and account pages get unique titles and descriptions from route params.
- **robots.txt** — Generated at `/robots.txt` (allows all, points to sitemap).
- **Sitemap** — Generated at `/sitemap.xml` (home page).
- **Structured data** — JSON-LD WebSite and Organization schema for rich search results.
- **Manifest** — PWA manifest at `/manifest.json`.
- **Icons** — Uses the checked-in `public/favicon.svg` plus the manifest.

### Optional richer assets

If you later want richer social cards or platform-specific icon assets, add them explicitly under `public/` and update `src/app/layout.tsx` to reference them. The current repo only relies on assets that are already checked in.

### Search engine verification

Add verification codes from [Google Search Console](https://search.google.com/search-console) or [Bing Webmaster Tools](https://www.bing.com/webmasters) via environment variables:

```
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your-google-code
NEXT_PUBLIC_BING_SITE_VERIFICATION=your-bing-code
```

## Reference

- **RPC spec / QA docs:** linked from the app using `NEXT_PUBLIC_BOING_PROTOCOL_DOCS_REPO` (default `Boing-Network/boing.network` on `main` under `docs/`).
- **Cross-repo handoff (Express, Observer, partners):** [HANDOFF-DEPENDENT-PROJECTS.md](https://github.com/Boing-Network/boing.network/blob/main/docs/HANDOFF-DEPENDENT-PROJECTS.md) and [THREE-CODEBASE-ALIGNMENT.md](https://github.com/Boing-Network/boing.network/blob/main/docs/THREE-CODEBASE-ALIGNMENT.md) in the canonical `boing.network` repo (RPC defaults in **§2**; **§2.1** explains public testnet vs local node for methods such as `boing_getQaRegistry`).
- **Native DEX directory Worker (D1, pagination, snapshot limits):** [HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md](https://github.com/Boing-Network/boing.network/blob/main/docs/HANDOFF_NATIVE_DEX_DIRECTORY_R2_AND_CHAIN.md).
- **Wallet/auth alignment:** See [HANDOFF.md](HANDOFF.md) (sync review and wallet integration notes).
- **Design system / explorer prompt:** under `docs/` in the same GitHub repo as above (see boing.network monorepo).

### Verification (from `boing.network` clone)

Cross-check public RPC and SDK the same way operators do: `boing-sdk` **`npm run build`** / **`npm test`**, tutorial **`preflight-rpc`**, and **`print-native-dex-routes`** — see [HANDOFF-DEPENDENT-PROJECTS.md §5](https://github.com/Boing-Network/boing.network/blob/main/docs/HANDOFF-DEPENDENT-PROJECTS.md#5-verification-commands-from-boingnetwork-clone) and [PRE-VIBEMINER-NODE-COMMANDS.md](https://github.com/Boing-Network/boing.network/blob/main/docs/PRE-VIBEMINER-NODE-COMMANDS.md).

---

*Boing Network — Authentic. Decentralized. Optimal. Sustainable.*
