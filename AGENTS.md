## Learned User Preferences

- After substantive work, the user often wants changes committed and pushed to GitHub for deployment.
- Prefer committing and pushing directly on `main` unless explicitly asked for a feature branch or PR workflow.
- Cloudflare deployment for this app: env and `wrangler.toml` wiring matter; secrets are sometimes created or managed through the Cloudflare dashboard when that fits the workflow.
- The home page “latest blocks” section should auto-refresh on a slower cadence than headline stats (roughly 30 seconds to one minute was the settled range).
- Sitewide typography: Comfortaa font.

## Learned Workspace Facts

- Default public testnet RPC is `https://testnet-rpc.boing.network/` (read-only, no API key); Testnet should use that rather than localhost unless the user explicitly chooses local or custom RPC.
- DEX listing aligns to one RPC snapshot: `boing_getNetworkInfo` fields `developer.dex_discovery_methods` and `end_user.canonical_native_dex_factory` together with factory-scoped `boing_listDexPools` and `boing_listDexTokens`.
- Node operator defaults for metadata scan depth, receipt caps, and related env are documented in the boing.network repo (`tools/boing-node-public-testnet.env.example`, `docs/PUBLIC-RPC-NODE-UPGRADE-CHECKLIST.md`); env-only updates need a process restart on the node, code changes need a new `boing-node` build.
- Token and asset discoverability pages aggregate from RPC with real limits (timeouts, pruning, receipt coverage); durable planet-scale indexing is a separate OBS-1 / indexer concern, not the same as bounded RPC aggregation.
- Explorer QA registry and routine chain reads target the public testnet RPC; upgrading only a user’s local node does not change production observer behavior.
- Browser direct calls to the public RPC can fail CORS; same-origin API routes or proxy patterns are the right fix when preflight from the explorer origin is blocked.
