# Boing Observer Sync Review — 2026-03-06

This note records the concrete `boing.observer` sync pass performed against the current `boing.network` docs and portal rollout.

## Fixed in this repo

- Replaced stale QA links with the canonical `QUALITY-ASSURANCE-NETWORK.md` doc in `boing.network`.
- Updated QA wording to match the current Boing terminology:
  - `allow`
  - `reject`
  - `unsure`
  - community QA pool
- Surfaced `doc_url` from `boing_qaCheck` responses when provided by the node.
- Added optional `description_hash` input support to the explorer QA pre-flight UI so it matches the current public QA/RPC docs more closely.
- Added advanced optional `asset_name` and `asset_symbol` QA metadata inputs for the current runtime RPC shape, with guardrails around parameter ordering.
- Removed the misleading mainnet fallback behavior. The explorer now stays on testnet unless a distinct `NEXT_PUBLIC_MAINNET_RPC` is configured.
- Updated the network selector and persisted network handling so `mainnet` is only selectable when it is actually configured.
- Updated repo docs to describe the current testnet-first rollout and to clarify that the explorer faucet is a direct RPC helper while the canonical public faucet page lives on `boing.network`.
- De-emphasized the explorer faucet in navigation and primary UX in favor of the canonical public faucet page on `boing.network`.
- Added explicit wallet-integration notes so future explorer account-aware features reuse the current Boing provider and auth contract.

## Still documented, not changed yet

- The explorer still contains its own faucet helper route. This is intentional for advanced/direct RPC use, but the broader Boing public onboarding flow is centered on `boing.network/network/faucet`.
- The explorer does not implement wallet connect today. If account-aware features are added later, they should reuse the provider and auth contract already documented in:
  - `boing.network/docs/WALLET-CONNECTION-AND-SIGNIN.md`
  - `boing.network/docs/PORTAL-WALLET-AUTH-ROLLOUT.md`
- A shared cross-app metadata/config source is still recommended so `boing.network`, `boing.express`, and `boing.observer` do not drift on chain IDs, endpoints, and canonical URLs.

## Files updated in this sync pass

- `src/lib/rpc-client.ts`
- `src/components/network-selector.tsx`
- `src/context/network-context.tsx`
- `src/lib/constants.ts`
- `src/lib/rpc-methods.ts`
- `src/components/header.tsx`
- `src/app/tools/qa-check/page.tsx`
- `src/app/about/page.tsx`
- `src/app/faucet/page.tsx`
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `README.md`
- `HANDOFF.md`
- `WALLET-INTEGRATION-NOTES.md`
