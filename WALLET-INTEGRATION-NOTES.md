# Boing Observer Wallet Integration Notes

`boing.observer` does not implement wallet connect today. This file exists so that any future account-aware explorer features stay aligned with the current Boing website and wallet contract instead of creating explorer-specific behavior.

## Use the existing Boing contract

If the explorer later adds wallet-aware features such as:

- account shortcuts
- faucet autofill
- saved watchlists
- authenticated QA helper flows
- transaction receipt linking
- user sessions

then it should reuse the same provider and sign-in conventions already documented in `boing.network`.

Preferred provider methods:

- `boing_requestAccounts`
- `boing_signMessage`
- `boing_chainId`
- `boing_switchChain`

Compatibility aliases that may still be used when the wallet exposes them:

- `eth_requestAccounts`
- `personal_sign`
- `eth_chainId`
- `wallet_switchEthereumChain`

## Testnet expectations

- Current Boing public rollout is testnet-first.
- The portal sign-in flow expects Boing testnet chain ID `0x1b01`.
- Account format is `0x` + 32-byte hex.
- Authentication should verify an Ed25519 signature against the account public key, not just trust that the wallet returned an address.

## Sign-in message shape

If the explorer ever needs user authentication, it should reuse the nonce-backed message format already used by the portal:

```txt
Sign in to Boing Portal
Origin: {origin}
Timestamp: {timestamp}
Nonce: {serverNonce}
```

If explorer-specific wording is ever introduced, do it intentionally and update the shared docs at the same time. Avoid drifting provider methods, chain checks, or message formats across `boing.network`, `boing.express`, and `boing.observer`.

## Canonical references

- `boing.network/docs/WALLET-CONNECTION-AND-SIGNIN.md`
- `boing.network/docs/PORTAL-WALLET-AUTH-ROLLOUT.md`
- `boing.network/docs/BOING-OBSERVER-AND-EXPRESS-BUILD.md`
